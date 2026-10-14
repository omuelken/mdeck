// The presenter view's state that lives outside it: who is connected, the
// launch page, pairing, full screen, the layout, and the room the iPad's
// Safari leaves it.
import { useEffect, useState } from 'preact/hooks'
import { devPath } from '../../core/devPath.js'
import { pairingLost } from '../../live/pairing.js'
import { fullscreenAvailable, fullscreenElement, toggleFullscreen, onFullscreenChange } from '../stage/fullscreen.js'

// Who is connected, as the presenter's main frame hears it from the server.
// Kept from the first message on, since a presenter view opened in a
// background tab runs its effects only once it is shown.
let lastPresence = null
const presenceListeners = new Set()
export function followPresence() {
  window.addEventListener('message', ({ data, origin }) => {
    if (origin !== window.location.origin || !data?.presence) return
    lastPresence = data.presence
    for (const listener of presenceListeners) listener(lastPresence)
  })
}
export function usePresence() {
  const [presence, setPresence] = useState(lastPresence)
  useEffect(() => {
    presenceListeners.add(setPresence)
    setPresence(lastPresence)
    return () => presenceListeners.delete(setPresence)
  }, [])
  return presence
}

// The launch page of `mdeck run`, when this computer's presenter view was
// served by it; a built deck, `mdeck edit` and a paired iPad have none.
export function useLaunchPage() {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!import.meta.env.DEV) return
    fetch(devPath('__mdeck/home/info'), { cache: 'no-store' }).then(response => { if (response.ok) setUrl(devPath('home.html')) }, () => {})
  }, [])
  return url
}

// A paired iPad that the computer no longer knows (mdeck run restarted,
// or Unpair) says so, instead of keeping what it does to itself.
export function useUnpaired() {
  const [unpaired, setUnpaired] = useState(false)
  useEffect(() => {
    if (!import.meta.env.DEV) return
    let gone = false
    const check = () => { if (document.visibilityState === 'visible') pairingLost().then(lost => { if (!gone) setUnpaired(lost) }) }
    check()
    const timer = setInterval(check, 10000)
    document.addEventListener('visibilitychange', check)
    return () => { gone = true; clearInterval(timer); document.removeEventListener('visibilitychange', check) }
  }, [])
  return unpaired
}

// A phone's screen must not lock in the middle of the talk (where the
// browser lets a page ask: https or this computer).
export function useWakeLock(on) {
  useEffect(() => {
    if (!on || !navigator.wakeLock) return
    let lock = null, gone = false
    const ask = () => { if (document.visibilityState === 'visible') navigator.wakeLock.request('screen').then(held => { if (gone) held.release(); else lock = held }, () => {}) }
    ask()
    document.addEventListener('visibilitychange', ask)
    return () => { gone = true; document.removeEventListener('visibilitychange', ask); lock?.release().catch(() => {}) }
  }, [on])
}

// The button enters and leaves full screen, and shows which it will do.
export function useFullscreen() {
  const [on, setOn] = useState(() => !!fullscreenElement())
  useEffect(() => onFullscreenChange(setOn), [])
  return { available: fullscreenAvailable(), on, toggle: () => toggleFullscreen() }
}

export const PRESENTER_LAYOUTS = ['speaker', 'slide', 'remote']
const LAYOUT_KEY = 'mdeck-presenter-layout'
// A touch screen gets the slide alone, a computer the speaker layout. The
// phone remote is chosen, not guessed: its pairing code opens ?layout=remote.
function defaultLayout() {
  return matchMedia('(pointer: coarse)').matches ? 'slide' : 'speaker'
}
// ?layout= in the address (from a pairing code) chooses the layout; the
// device then remembers it like a layout chosen with the buttons.
function requestedLayout() {
  const url = new URL(window.location.href)
  const asked = url.searchParams.get('layout')
  if (!asked) return null
  url.searchParams.delete('layout')
  try { history.replaceState(history.state, '', url) } catch {}
  return PRESENTER_LAYOUTS.includes(asked) ? asked : null
}
// The layout asked for in the address, the one this device chose last time,
// or the one that suits it; a layout chosen is remembered.
export function useLayout() {
  const [layout, setLayout] = useState(() => {
    const asked = requestedLayout()
    if (asked) { try { localStorage.setItem(LAYOUT_KEY, asked) } catch {} return asked }
    try { const saved = localStorage.getItem(LAYOUT_KEY); if (PRESENTER_LAYOUTS.includes(saved)) return saved } catch {}
    return defaultLayout()
  })
  const choose = next => {
    setLayout(next)
    try { localStorage.setItem(LAYOUT_KEY, next) } catch {}
  }
  return [layout, choose]
}
// Larger notes in the phone remote, whether the address or the device chose
// it; read before useLayout takes ?layout= out of the address.
export function initialNoteSize() {
  let saved = null
  try { saved = localStorage.getItem(LAYOUT_KEY) } catch {}
  return (new URL(window.location.href).searchParams.get('layout') ?? saved) === 'remote' ? 17 : 13
}

// The iPad: the slide sits below the bar, which never covers it.
export function useBottomOf(ref, deps) {
  const [bottom, setBottom] = useState(0)
  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const measure = () => setBottom(Math.ceil(element.offsetTop + element.offsetHeight))
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    measure()
    return () => observer.disconnect()
  }, deps)
  return bottom
}

// Safari on an iPad lays its bars over the page: the view starts where the
// page does, below them, and ends where the visible part of the window
// does, so neither bar of the view is under Safari's.
export function useVisibleHeight(ref, deps) {
  const [height, setHeight] = useState(null)
  useEffect(() => {
    const page = ref.current
    if (!page) return
    const viewport = window.visualViewport
    const measure = () => {
      if (window.scrollY || window.scrollX) window.scrollTo(0, 0)
      const bottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight
      setHeight(Math.max(0, Math.floor(bottom - page.getBoundingClientRect().top)))
    }
    measure()
    for (const target of [window, viewport]) { target?.addEventListener('resize', measure); target?.addEventListener('scroll', measure) }
    return () => { for (const target of [window, viewport]) { target?.removeEventListener('resize', measure); target?.removeEventListener('scroll', measure) } }
  }, deps)
  return height
}
