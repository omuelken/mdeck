// Audience interaction for slide components: `import { useRoom } from 'mdeck/live'`.
//
// Relay mode: the room server connects the presenter's screen and the phones
// and never needs the deck. Every activity in a deck shares one join link,
// <server>/<code>. The presenter's screen announces the activity on the current
// slide together with what the phone should show (a component's `phone`
// description), the deck's look and the words in its language; the room
// server's answer page shows that. On the slides, `useRoom` follows the
// answers.
import { useCallback, useEffect, useState } from 'preact/hooks'
import { sessionCode } from './code.js'
import { pairToken } from './pairing.js'
import { t, deckLanguage } from '../core/labels.js'

// The QR code component the built-in poll uses, for your own activities.
export { default as QrCode } from '../components/QrCode.jsx'

let settings = { server: null, code: '000000' }

// Called by the runtime with the deck settings.
export function configureLive(deckConfig = {}) {
  const live = deckConfig.live ?? {}
  settings = { server: typeof live.server === 'string' ? live.server.replace(/\/+$/, '') : null, code: sessionCode(deckConfig) }
  takeKeyFromAddress()
}

/** The deck's session code, the last part of its join link. */
export const liveCode = () => settings.code

const page = () => new URL(window.location.href)
// Without `live.server`, the room server built into `mdeck dev`.
const serverBase = () => settings.server ?? new URL('/__mdeck/live', window.location.origin).href
const roomPath = room => `${serverBase()}/rooms/${encodeURIComponent(`${settings.code}.${room}`)}`
const sessionPath = () => `${serverBase()}/rooms/${encodeURIComponent(settings.code)}`

// Which rooms keep a live connection: those on the current slide, set by the
// runtime for each deck it shows. Browsers allow only six connections per
// server, shared by all tabs, so a deck must not hold one per activity.
// null means every room is live (Read mode, print, pages without slides).
let activeRooms = null
const activeListeners = new Set()
export function setActiveRooms(rooms) {
  activeRooms = rooms == null ? null : new Set(rooms.map(String))
  for (const listener of activeListeners) listener()
}
function useActive(room) {
  const [, redraw] = useState(0)
  useEffect(() => {
    const listener = () => redraw(n => n + 1)
    activeListeners.add(listener)
    return () => activeListeners.delete(listener)
  }, [])
  return activeRooms == null || activeRooms.has(String(room))
}

// The presenter unlocks a standalone room server once with ?livekey=… in the
// address. The code is kept in this browser, where the presenter view's other
// windows find it, and taken out of the address bar at once, so it never shows
// on a projector.
let givenKey = null
function takeKeyFromAddress() {
  const url = page()
  const given = url.searchParams.get('livekey')
  if (!given) return
  givenKey = given
  try { localStorage.setItem(`mdeck-live-key:${serverBase()}`, given) } catch {}
  url.searchParams.delete('livekey')
  try { history.replaceState(history.state, '', url) } catch {}
}
// The room server built into `mdeck dev` also lets a paired iPad in.
function presenterKey() {
  let key = givenKey
  try { key = localStorage.getItem(`mdeck-live-key:${serverBase()}`) ?? givenKey } catch {}
  return key ?? (settings.server ? null : pairToken())
}
const withKey = (headers = {}) => { const key = presenterKey(); return key ? { ...headers, Authorization: `Bearer ${key}` } : headers }

// Only an answer is kept; after a failure the next call asks again, so a room
// server that starts later is found. `reachable` is false when it did not answer.
let infoRequest = null
function serverInfo() {
  infoRequest ??= fetch(`${serverBase()}/info`, { headers: withKey() })
    .then(response => { if (!response.ok) throw new Error(String(response.status)); return response.json() })
    .then(info => ({ ...info, reachable: true }))
    .catch(() => { infoRequest = null; return { reachable: false } })
  return infoRequest
}

// The join link phones can open: `live.server`, or `mdeck dev --host`'s
// network address. null when only this computer can reach the room server;
// `localJoinUrl` then still opens the answer page here, for trying it out.
function joinUrl(info) {
  if (settings.server) return `${settings.server}/${settings.code}`
  return info.network ? new URL(`__mdeck/live/${settings.code}`, info.network).href : null
}
const localJoinUrl = () => `${serverBase()}/${settings.code}`

/**
 * Follow a room's answers on a slide.
 *   messages  every answer so far: { n, at, from, data: { value } }
 *   joinUrl   the deck's join link for the QR code, or null if phones cannot
 *             reach the room server; localJoinUrl works on this computer
 *   canReset / reset()  presenter only
 *   connected false until the live stream is open
 * Off the current slide the room keeps its last messages but disconnects.
 */
export function useRoom(room) {
  const live = useActive(room)
  const [messages, setMessages] = useState([])
  const [connected, setConnected] = useState(false)
  const [info, setInfo] = useState({})

  useEffect(() => { serverInfo().then(setInfo) }, [])

  useEffect(() => {
    if (!live || !room || typeof EventSource === 'undefined') return
    const source = new EventSource(`${roomPath(room)}/events`)
    source.addEventListener('open', () => setConnected(true))
    source.addEventListener('error', () => setConnected(false))
    source.addEventListener('snapshot', event => setMessages(JSON.parse(event.data).messages))
    source.addEventListener('message', event => { const message = JSON.parse(event.data); setMessages(list => list.some(m => m.n === message.n) ? list : [...list, message]) })
    source.addEventListener('reset', () => setMessages([]))
    return () => { source.close(); setConnected(false) }
  }, [room, live])

  const reset = useCallback(async () => {
    const response = await fetch(`${roomPath(room)}/reset`, { method: 'POST', headers: withKey({ 'Content-Type': 'application/json' }), body: '{}' })
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? 'Could not reset')
  }, [room])

  return { messages, reset, connected, canReset: !!info.canReset, joinUrl: joinUrl(info), localJoinUrl: localJoinUrl(), code: settings.code }
}

/** The deck's join link alone, for a slide that only invites people in (<join>). */
export function useJoinLink() {
  const [info, setInfo] = useState({})
  useEffect(() => { serverInfo().then(setInfo) }, [])
  return { joinUrl: joinUrl(info), localJoinUrl: localJoinUrl(), code: settings.code }
}

/** The latest answer of each device, e.g. to count votes that can be changed. */
export function latestByDevice(messages) {
  const latest = new Map()
  for (const message of messages) latest.set(message.from ?? `#${message.n}`, message)
  return [...latest.values()]
}

// ── The presenter's screen ──────────────────────────────────────────────────

// The deck's look as the answer page needs it: theme variables, font
// stylesheets and the style of a slide heading, read from the page that shows
// the slides (the presenter's current-slide frame, or the deck itself).
const LOOK_TOKENS = ['--bg', '--ink', '--ink-soft', '--muted', '--rule', '--surface', '--accent', '--accent-2', '--on-accent', '--font-body', '--font-display']
let lookSource = () => document
export function setLookSource(source) { lookSource = source }
export function captureLook(doc = lookSource()) {
  if (!doc?.documentElement) return null
  const style = getComputedStyle(doc.documentElement)
  const tokens = Object.fromEntries(LOOK_TOKENS.map(name => [name, style.getPropertyValue(name).trim()]).filter(([, value]) => value))
  const fonts = [...doc.querySelectorAll('link[data-deck-theme-font]')].map(link => link.href)
  // A frame that has not loaded its slides yet has no theme: send nothing, so
  // phones keep the look they have.
  if (!tokens['--bg'] && !tokens['--font-body']) return null
  const h1 = doc.querySelector('.slide-body h1')
  const hs = h1 && doc.defaultView.getComputedStyle(h1)
  // Letter spacing relative to the font size, so a slide heading's spacing
  // fits the much smaller heading on a phone.
  const spacing = hs && (hs.letterSpacing === 'normal' ? 'normal' : `${(parseFloat(hs.letterSpacing) / parseFloat(hs.fontSize)).toFixed(3)}em`)
  const heading = hs ? { family: hs.fontFamily, weight: hs.fontWeight, spacing, transform: hs.textTransform } : null
  return { tokens, fonts, heading }
}

// The words the answer page shows, in the deck's language.
const phoneWords = () => ({ waiting: t('respond.waiting'), pick: t('poll.pick'), thanks: t('poll.thanks'), send: t('respond.send'), sent: t('respond.sent') })

// The presenter's screen announces the activity on the current slide and
// repeats it every few seconds, so phones that join late and a room server
// that restarted catch up; the server passes on only changes. Only the
// presenter may: `steering` says whether this screen reaches the phones.
const REPEAT_MS = 4000
// This window, so the room server can tell its repeats from new changes.
const SCREEN = Math.random().toString(36).slice(2, 10)
let current = { room: null, activity: null, title: '', at: 0, screen: SCREEN }, repeat = null
let steering = null
let lastLook = null
const steeringListeners = new Set()
function report(next) {
  if (steering && steering.ok === next.ok && steering.reason === next.reason) return
  steering = next
  for (const listener of steeringListeners) listener(next)
}

// A presenter view outranks other deck windows in the same browser: while it
// runs, they stay quiet, so two screens on different slides or looks do not
// make the phones flip between them.
let role = 'screen'
export function actAsPresenter() { role = 'presenter' }
const presenterMark = () => `mdeck-live-presenter:${settings.code}`
function outranked() {
  try {
    if (role === 'presenter') { localStorage.setItem(presenterMark(), String(Date.now())); return false }
    return Date.now() - Number(localStorage.getItem(presenterMark()) ?? 0) < REPEAT_MS * 2.5
  } catch { return false }
}

async function sendCurrent() {
  if (outranked()) return
  const info = await serverInfo()
  if (!info.reachable) return report({ ok: false, reason: 'unreachable' })
  if (!info.canReset) return report({ ok: false, reason: presenterKey() ? 'wrong-code' : 'no-code' })
  const look = captureLook()
  if (look) lastLook = look
  const state = { ...current, look: lastLook, lang: deckLanguage(), labels: phoneWords() }
  try {
    const response = await fetch(`${sessionPath()}/state`, { method: 'POST', headers: withKey({ 'Content-Type': 'application/json' }), body: JSON.stringify({ state }) })
    const body = response.ok ? await response.json().catch(() => ({})) : {}
    report(!response.ok ? { ok: false, reason: response.status === 403 ? 'wrong-code' : 'unreachable' } : body.ignored ? { ok: false, reason: 'other-screen' } : { ok: true })
  } catch { report({ ok: false, reason: 'unreachable' }) }
}

/**
 * The activity on the current slide: { room, activity, title }, where
 * `activity` is what the phones show ({ type: 'choice' | 'text' | 'scale', … }),
 * or nothing between activities.
 */
export function announce({ room = null, activity = null, title = '', initial = false } = {}) {
  // `at` marks this change; the room server keeps the latest change of all
  // screens. A screen that just opened says 0, so opening a tab to look at
  // the deck does not take the phones away from the presenter.
  current = { room, activity, title, at: initial ? 0 : Date.now(), screen: SCREEN }
  sendCurrent()
  repeat ??= setInterval(sendCurrent, REPEAT_MS)
}

/**
 * The deck's stage room, which carries the presenter's position and live ink
 * to screens on other devices (src/runtime/ink/room.js).
 */
export function stageRoom() {
  return { url: `${sessionPath()}.stage`, headers: withKey, info: serverInfo, screen: SCREEN }
}

/** For the presenter view: null before the first announcement, else { ok, reason }. */
export function useSteering() {
  const [state, setState] = useState(steering)
  useEffect(() => {
    steeringListeners.add(setState)
    setState(steering)
    return () => steeringListeners.delete(setState)
  }, [])
  return state
}
