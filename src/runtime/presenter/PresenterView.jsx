// The presenter view: the slide in a frame of its own, with the notes, the
// next slide, the time and the controls, in three layouts (a computer, an
// iPad, a phone). It drives the frame, which tells the audience window and
// the phones; settings, the theme picker and its hooks have files of their own.
import { h, render } from 'preact'
import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { marked } from 'marked'
import { renderCitations } from '../citations.js'
import { parseSlides } from '../../core/parseSlides'
import { THEME_METAS, PALETTES } from '../themeLoader'
import { resolvePalette } from '../../extensions/appearance.js'
import { palettesFor } from '../../extensions/tokens.js'
import { S } from '../chrome.jsx'
import { actAsPresenter, setLookSource, useSteering } from '../../live/client.js'
import { createOrder } from '../syncOrder.js'
import { textDirection } from '../../core/languages.js'
import { Icon } from '../../components/Icon.jsx'
import { normalMode, hotspotMode } from '../hotspots.js'
import { planFor, scheduleAt, formatClock } from '../../core/timing.js'
import { KeyHelp, useKeyHelp } from '../KeyHelp.jsx'
import { Reactions } from '../Reactions.jsx'
import { reactionsOf } from '../../core/reactions.js'
import mdeckMark from '../../../assets/logo/mark.svg'
import { slidesContent, deckLang, LANGUAGES, chooseLanguage, withFileLanguage } from '../deckSource.js'
import { hasActivities, announceSlide } from '../phones.js'
import { controlUrl, DECK_CHANNEL, POSITION_KEY, sendTo } from '../deckChannel.js'
import { ToolButton, SlideControls, Connections, tool } from './PresenterChrome.jsx'
import { RehearsalSummary } from './RehearsalSummary.jsx'
import { useTalkTimer } from './useTalkTimer.js'
import { SlideJump } from './SlideJump.jsx'
import { ThemePicker } from './ThemePicker.jsx'
import { Settings } from './Settings.jsx'
import { buildChildUrl, buildAudienceUrl } from './frameUrls.js'
import { followPresence, usePresence, useLaunchPage, useUnpaired, useWakeLock, useFullscreen, useLayout, initialNoteSize, useBottomOf, useVisibleHeight } from './hooks.js'

const PresenterIcon = ({ name, size = 18 }) => <Icon name={name} size={size} style={{ display: 'block' }} />


// Whether this presenter screen moves the phones along, shown only for decks
// with activities: a failure used to be silent.
const STEERING = {
  'no-code': 'Phones don’t follow: no server key here.',
  'wrong-code': 'Phones don’t follow: key refused.',
  unreachable: 'Phones don’t follow: server not answering.',
  'other-screen': 'Phones follow another screen. Change slide to take them back.',
}
// A device the computer does not know (src/live/pairing.js).
const UNPAIRED = {
  lost: 'No longer paired: slide changes, drawings and polls stay on this device. Show a new pairing code on the computer and scan it.',
  missing: 'Not paired: slide changes and drawings do not reach the projector. Show a pairing code on the computer and scan it.',
}

// The iPad's bar, smaller than the computer's buttons (inline styles, hence
// !important); the timer with them. The page never scrolls, and is dark
// behind.
const SLIM_PILL = `
  html, body { overflow: hidden; overscroll-behavior: none; background: #111; }
  .presenter--slide .presenter-pill { padding: 3px !important; gap: 2px !important; }
  .presenter--slide .presenter-pill button { min-width: 34px !important; height: 34px !important; padding: 0 7px !important; border-radius: 9px !important; font-size: 13px !important; }
  .presenter--slide .presenter-pill button svg { width: 16px; height: 16px; }
  .presenter--slide .presenter-pill .presenter-clock { gap: 6px !important; }
  .presenter--slide .presenter-pill .presenter-slide-time { font-size: 11px !important; }
`
// The phone's bar, a little tighter, so it fits a 375 px wide phone with
// phones connected; on a narrower one it wraps instead of overlapping.
const SLIM_REMOTE_BAR = `
  .presenter-remote-bar { gap: 4px !important; }
  .presenter-remote-bar > button, .presenter-remote-bar > span > [class$="-toggle"] { min-width: 36px !important; padding: 0 7px !important; }
`
// A slide's first heading, as plain words, for the phone's "Next:" line.
function slideTitleOf(slide) {
  const texts = [slide?.content ?? '', ...Object.values(slide?.regions ?? {}).map(region => region.content ?? '')]
  for (const text of texts) {
    const heading = text.replace(/^(```|~~~)[\s\S]*?^\1/gm, '').match(/^#{1,3}\s+(.+)$/m)
    if (heading) return heading[1].replace(/[*_`]/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').trim()
  }
  return ''
}

// The position this view was at, kept across a reload (sessionStorage, as
// the timer's state is, POSITION_KEY): its frame opens there, instead of
// sending the audience window back to the first slide.
function keptPosition() {
  try {
    const kept = JSON.parse(sessionStorage.getItem(POSITION_KEY))
    if (Number.isInteger(kept?.index) && Number.isInteger(kept?.step)) return kept
  } catch {}
  return { index: 0, step: -1 }
}

function PresenterView({ deckConfig: firstConfig, slides: firstSlides }) {
  const [index, setIndex] = useState(() => Math.min(keptPosition().index, firstSlides.length - 1))
  // The notes, slide count and phones follow the language shown.
  const [lang, setLang] = useState(deckLang)
  const { slides, deckConfig } = useMemo(() => {
    if (!chooseLanguage(lang)) return { slides: firstSlides, deckConfig: firstConfig }
    const parsed = parseSlides(slidesContent)
    return { slides: parsed.slides, deckConfig: { ...firstConfig, ...withFileLanguage(parsed.deckConfig) } }
  }, [lang])
  const [theme, setTheme] = useState(deckConfig.theme ?? 'neue')
  // '' means the theme's own default, for both.
  const [palette, setPalette] = useState(deckConfig.palette ?? '')
  const [appearance, setAppearance] = useState(deckConfig.appearance ?? '')
  const [audienceConnected, setAudienceConnected] = useState(false)
  // Larger notes in the phone remote, whether the address or the device chose it.
  const [noteSize, setNoteSize] = useState(initialNoteSize)
  const [inking, setInking] = useState(false)
  // Black screen (B): the audience's screens are black, this view veils its slide.
  const [blank, setBlank] = useState(false)
  // The join code over the slide (J), on every screen.
  const [join, setJoin] = useState(false)
  // A frozen projector (Z): the position the audience's screens keep, or null.
  const [freeze, setFreeze] = useState(null)
  // The phone clicker: the slide's controls, as its frame reports them (slideControls.js).
  const [slideControls, setSlideControls] = useState({ items: [], hotspots: 0, hotspot: null })
  // The overview (O) in this view's slide frame: keys go to it while it is open.
  const [overviewOpen, setOverviewOpen] = useState(false)
  const overviewRef = useRef(false)
  overviewRef.current = overviewOpen
  // The keys that work now, over everything (?).
  const [helpOpen, setHelpOpen] = useKeyHelp()
  // Hotspots: the deck's setting until the presenter switches them (H).
  const deckHotspots = (normalMode(deckConfig.hotspots) ?? 'off') !== 'off'
  const [hotspotsForced, setHotspotsForced] = useState(null)
  const hotspotsOn = hotspotsForced ?? deckHotspots
  const hotspotsRef = useRef(null)
  hotspotsRef.current = hotspotsForced
  const toggleHotspots = () => setHotspotsForced(forced => !(forced ?? deckHotspots))
  // Whether the number keys zoom on the slide shown: a slide may have its own setting.
  const slideHotspots = hotspotMode({ slide: slides[index]?.meta.hotspots, deck: deckConfig.hotspots, forced: hotspotsForced }) !== 'off'
  const presence = usePresence()
  const launchPage = useLaunchPage()
  // Drawing in the slide's frame: this page around it must not pan or bounce either.
  useEffect(() => { document.documentElement.classList.toggle('is-inking', inking) }, [inking])
  // The slide zooms itself (two fingers in its frame); Safari's page zoom
  // would enlarge the bars around it as well.
  useEffect(() => {
    const stop = event => event.preventDefault()
    document.addEventListener('gesturestart', stop, { passive: false })
    return () => document.removeEventListener('gesturestart', stop)
  }, [])
  // 'slide': the slide fills the screen (an iPad); the notes open as a drawer.
  // 'remote': a phone in the hand, with the slide small, the notes and big
  // buttons to go on and back.
  const [layout, setLayout] = useLayout()
  const remoteLayout = layout === 'remote'
  // A phone's screen must not lock in the middle of the talk.
  useWakeLock(remoteLayout)
  const [drawerOpen, setDrawerOpen] = useState(false)
  // The iPad: the slide sits below the bar, which never covers it.
  const pillRef = useRef(null)
  const pillBottom = useBottomOf(pillRef, [layout])
  // Safari on an iPad lays its bars over the page (useVisibleHeight).
  const pageRef = useRef(null)
  const pageHeight = useVisibleHeight(pageRef, [layout])
  const slideLayout = layout === 'slide'
  function chooseLayout(next) {
    setLayout(next)
    setDrawerOpen(false)
  }
  const fullscreen = useFullscreen()
  const canFullscreen = fullscreen.available
  const isFullscreen = fullscreen.on
  const fullscreenLabel = isFullscreen ? 'Exit full screen (F)' : 'Full screen (F)'
  const fullscreenIcon = isFullscreen ? 'fullscreen-exit' : 'fullscreen'

  const [themeModalOpen, setThemeModalOpen] = useState(false)
  // The clock, and the slides' times (`time:`) to hold it against. Times a
  // rehearsal saved count at once; the deck file is not read again mid-talk.
  const [savedTimes, setSavedTimes] = useState({})
  const plan = useMemo(() => planFor(slides, deckConfig, savedTimes), [slides, deckConfig, savedTimes])
  const timer = useTalkTimer(`mdeck-timer:${DECK_CHANNEL}`, slides[index]?.id, { rehearse: controlUrl.searchParams.get('rehearse') === '1' })
  const [summary, setSummary] = useState(null)
  const [savedNote, setSavedNote] = useState(null)
  // A reload after the rehearsal must not start another one.
  useEffect(() => {
    if (!controlUrl.searchParams.has('rehearse')) return
    const url = new URL(window.location.href)
    url.searchParams.delete('rehearse')
    history.replaceState(null, '', url)
  }, [])
  function finishRehearsal() {
    timer.pause()
    setSummary(timer.spent())
  }
  const timerRef = useRef(timer)
  timerRef.current = timer
  // Next at the very end of the deck ends a rehearsal.
  const atEndRef = useRef(false)
  const atRehearsalEnd = () => timerRef.current.rehearsing && atEndRef.current
  const finishRehearsalRef = useRef(finishRehearsal)
  finishRehearsalRef.current = finishRehearsal
  const summaryRef = useRef(false)
  summaryRef.current = !!summary

  const iframeRef = useRef(null)
  const toggleOverviewRef = useRef(null)
  const previewRef = useRef(null)
  const audienceRef = useRef(null)
  const bcRef = useRef(null)
  // Positions sent to and taken from audience windows are ordered (syncOrder.js);
  // the clock carries on after a reload, like the position.
  const orderRef = useRef(null)
  orderRef.current ??= createOrder(undefined, { storageKey: `mdeck-order:${DECK_CHANNEL}` })
  const indexRef = useRef(index)
  const langRef = useRef(lang)
  langRef.current = lang
  const stateRef = useRef(keptPosition())
  indexRef.current = index
  const countRef = useRef(slides.length)
  countRef.current = slides.length
  // Phones see the look of the slide this view shows, read from its frame.
  useEffect(() => { setLookSource(() => iframeRef.current?.contentDocument) }, [])
  const announcedOnce = useRef(false)
  // While the projector is frozen, the phones stay on its slide too.
  const audienceIndex = freeze ? freeze.index : index
  useEffect(() => {
    announceSlide({ slides, deckConfig }, audienceIndex, { initial: !announcedOnce.current })
    announcedOnce.current = true
  }, [audienceIndex, lang])

  const themeMeta = THEME_METAS[theme]
  // The palettes this theme offers, and what the deck shows right now.
  const offered = palettesFor(themeMeta, PALETTES)
  const shown = resolvePalette({ theme: themeMeta, palettes: PALETTES, palette, appearance })
  // A theme that does not offer the chosen palette falls back to its own.
  useEffect(() => { if (palette && !offered.some(p => p.id === palette)) setPalette('') }, [theme])
  const notes = useMemo(() => slides.map(s => s.meta?.notes ?? ''), [slides])
  // Preserve current slide when theme/palette causes an iframe reload
  const iframeSrc = useMemo(() => buildChildUrl(theme, palette, appearance, indexRef.current, { draw: true, remote: remoteLayout }), [theme, palette, appearance, remoteLayout])
  // previewSrc only recomputes on a change of look; slide changes use postMessage
  const previewSrc = useMemo(
    () => buildChildUrl(theme, palette, appearance, indexRef.current + 1),
    [theme, palette, appearance]
  )

  // BroadcastChannel for audience sync — more reliable than cross-window postMessage
  useEffect(() => {
    bcRef.current = new BroadcastChannel(DECK_CHANNEL)
    bcRef.current.onmessage = ({ data }) => {
      if (data?.audienceReady) bcRef.current?.postMessage({ deckControl: { command: 'setState', value: stateRef.current, order: orderRef.current.current() } })
      // An audience window moved: follow it, unless this view has moved on since.
      if (data?.deckStateChanged && orderRef.current.accept(data.order)) sendTo(iframeRef.current?.contentWindow, 'setState', data.deckStateChanged)
    }
    return () => bcRef.current?.close()
  }, [])

  // When the presenter iframe navigates: update displayed index, sync audience + preview.
  // Skip audience/preview sync on 'init' (iframe load/reload) — the audience already
  // opened at the correct slide, and previewSrc encodes the right hash on reload.
  useEffect(() => {
    function onMessage({ data, source }) {
      if (source === previewRef.current?.contentWindow) {
        // A preview that (re)loaded, such as after the last slide, opens in
        // the deck file's language: it gets the one shown.
        if (data?.deckStateChanged && data.reason === 'init') {
          sendTo(source, 'goTo', indexRef.current + 1)
          if (LANGUAGES.length) sendTo(source, 'setLanguage', langRef.current)
        }
        return
      }
      if (source !== iframeRef.current?.contentWindow) return
      if (typeof data?.inkMode === 'boolean') { setInking(data.inkMode); return }
      // The clicker's slide frame says what can be done on the slide shown.
      if (data?.slideControls) { setSlideControls(data.slideControls); return }
      if (typeof data?.overview === 'boolean') { setOverviewOpen(data.overview); return }
      // ? typed while the slide's frame had the keyboard.
      if (data?.keyHelp === 'toggle') { setHelpOpen(open => !open); return }
      // A key the frame had no use for (T, H, L …): as if typed here.
      if (typeof data?.presenterKey === 'string') { window.dispatchEvent(new KeyboardEvent('keydown', { key: data.presenterKey })); return }
      // Another screen (a paired iPad) switched the language; the notes follow.
      if (LANGUAGES.includes(data?.deckLanguage)) { setLang(data.deckLanguage); return }
      if (!data?.deckStateChanged) return
      const state = data.deckStateChanged
      const i = state.index
      // Theme reloads must not reset the current reveal position.
      // A reloaded frame opens in the deck file's language; after its place
      // is back, it gets the one shown.
      const keepLanguage = () => {
        if (data.reason !== 'init') return
        if (LANGUAGES.length) sendTo(iframeRef.current?.contentWindow, 'setLanguage', langRef.current)
        // A reloaded frame keeps the presenter's hotspots switch too.
        if (hotspotsRef.current != null) sendTo(iframeRef.current?.contentWindow, 'hotspots', hotspotsRef.current)
      }
      if (data.reason === 'init' && stateRef.current.index === i) {
        sendTo(iframeRef.current?.contentWindow, 'setState', stateRef.current)
        keepLanguage()
        return
      }
      stateRef.current = state
      try { sessionStorage.setItem(POSITION_KEY, JSON.stringify(state)) } catch {}
      atEndRef.current = !!data.atEnd
      setIndex(i)
      setBlank(!!state.blank)
      setJoin(!!state.join)
      setFreeze(state.freeze ?? null)
      if (data.reason !== 'sync') {
        bcRef.current?.postMessage({ deckControl: { command: 'setState', value: state, order: orderRef.current.stamp() } })
      }
      sendTo(previewRef.current?.contentWindow, 'goTo', i + 1)
      keepLanguage()
    }
    window.addEventListener('message', onMessage)
    // The frame may have started drawing before this listener was there.
    try { if (iframeRef.current?.contentWindow?.document.querySelector('deck-stage')?.inking) setInking(true) } catch {}
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // Keyboard nav in the presenter sidebar → drive the iframe only;
  // audience follows automatically via the slideIndexChanged → BroadcastChannel path
  useEffect(() => {
    function onKey(e) {
      if (e.target?.matches?.('input, select, textarea')) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (summaryRef.current) return
      if (overviewRef.current && ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'PageDown', 'PageUp', 'Home', 'End', 'Enter', ' ', 'Escape', 'o', 'O'].includes(e.key)) {
        e.preventDefault()
        sendTo(iframeRef.current?.contentWindow, 'overviewKey', e.key)
        return
      }
      if (e.key === 'o' || e.key === 'O') { e.preventDefault(); toggleOverviewRef.current(); return }
      if (e.key === 't' || e.key === 'T') { e.preventDefault(); timerRef.current.toggle(); return }
      // Home and End go to the first and the last slide; R starts over, with every step hidden again.
      if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); sendTo(iframeRef.current?.contentWindow, 'goTo', e.key === 'Home' ? 0 : countRef.current - 1); return }
      const cmd =
        (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') ? 'next' :
        (e.key === 'ArrowLeft'  || e.key === 'PageUp')                    ? 'prev' :
        (e.key === 'r' || e.key === 'R')                                  ? 'reset' :
        (e.key === 'd' || e.key === 'D')                                  ? 'ink' : null
      if ((e.key === 'f' || e.key === 'F') && fullscreen.available) { e.preventDefault(); fullscreen.toggle(); return }
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); setDrawerOpen(open => !open); return }
      if ((e.key === 'l' || e.key === 'L') && LANGUAGES.length) { e.preventDefault(); nextLanguage(); return }
      if (e.key === 'h' || e.key === 'H') { e.preventDefault(); toggleHotspots(); return }
      // B, or a clicker's blank button (a full stop).
      if (e.key === 'b' || e.key === 'B' || e.key === '.') { e.preventDefault(); sendTo(iframeRef.current?.contentWindow, 'blank', 'toggle'); return }
      if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); sendTo(iframeRef.current?.contentWindow, 'freeze', 'toggle'); return }
      if ((e.key === 'j' || e.key === 'J') && (hasActivities() || reactionsOf(firstConfig))) { e.preventDefault(); sendTo(iframeRef.current?.contentWindow, 'join', 'toggle'); return }
      // Digits zoom to hotspots; Escape zooms out.
      if (/^[0-9]$/.test(e.key) || e.key === 'Escape') { if (e.key !== 'Escape') e.preventDefault(); sendTo(iframeRef.current?.contentWindow, 'hotspotKey', e.key); return }
      if (!cmd) return
      e.preventDefault()
      if (cmd === 'next' && atRehearsalEnd()) { finishRehearsalRef.current(); return }
      sendTo(iframeRef.current?.contentWindow, cmd, cmd === 'ink' ? 'toggle' : undefined)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // The presenter's hotspots switch goes to the slide frame.
  const hotspotsOnce = useRef(false)
  useEffect(() => {
    if (!hotspotsOnce.current) { hotspotsOnce.current = true; return }
    sendTo(iframeRef.current?.contentWindow, 'hotspots', hotspotsForced)
  }, [hotspotsForced])


  // When theme/palette changes, tell the audience to hot-swap its theme without
  // a reload. Phones pick it up with the next announcement.
  useEffect(() => {
    bcRef.current?.postMessage({ deckControl: { command: 'setTheme', theme, palette, appearance } })
  }, [theme, palette, appearance])

  // Another language: every window swaps its slides in place. The address
  // keeps it, for a reload and for windows opened later.
  const langOnce = useRef(false)
  useEffect(() => {
    if (!langOnce.current) { langOnce.current = true; return }
    const url = new URL(window.location.href)
    url.searchParams.set('lang', lang)
    history.replaceState(null, '', url)
    for (const win of [iframeRef.current?.contentWindow, previewRef.current?.contentWindow]) sendTo(win, 'setLanguage', lang)
    bcRef.current?.postMessage({ deckControl: { command: 'setLanguage', value: lang } })
  }, [lang])
  const nextLanguage = () => setLang(current => LANGUAGES[(LANGUAGES.indexOf(current) + 1) % LANGUAGES.length])

  const toggleBlank = () => sendTo(iframeRef.current?.contentWindow, 'blank', 'toggle')
  // In the slide-only layout the notes drawer would cover the grid.
  const toggleOverview = () => { setDrawerOpen(false); sendTo(iframeRef.current?.contentWindow, 'overview', 'toggle') }
  toggleOverviewRef.current = toggleOverview
  const blankLabel = blank ? 'Show the slide again (B)' : 'Black screen for the audience (B)'
  const blankOn = { background: '#f0f0f0', borderColor: '#f0f0f0', color: '#111' }

  // Nav buttons drive the presenter iframe; audience follows via slideIndexChanged
  function navCommand(cmd, value) {
    if (cmd === 'next' && atRehearsalEnd()) return finishRehearsal()
    sendTo(iframeRef.current?.contentWindow, cmd, value)
  }

  function openAudienceWindow() {
    // While frozen (Z), it opens at the frozen slide: the one shown here may
    // be the one the audience must not see yet, such as the solution.
    const aw = window.open(
      buildAudienceUrl(theme, palette, appearance, freeze?.index ?? indexRef.current),
      'deck-audience-view'
    )
    if (!aw) return
    audienceRef.current = aw
    setAudienceConnected(true)
  }

  // Whether the phones follow this screen; told only when they do not.
  const steering = useSteering()
  // A paired iPad that the computer no longer knows says so.
  const unpaired = useUnpaired()
  const note = notes[index] || ''
  const hasNext = index + 1 < slides.length

  const clock = formatClock(Math.floor(timer.totalElapsed)).padStart(5, '0')
  // With times in the deck: what is left of this slide, and how the talk
  // stands against the plan (behind when positive).
  const timed = plan.total > 0
  const { planned, slideLeft, delta } = scheduleAt(plan, index, timer)
  const slideColor = !planned ? '#888' : slideLeft <= 0 ? '#f28b82' : slideLeft <= 15 ? '#f5a524' : '#ccc'
  const slideText = !planned ? 'no time' : slideLeft > 0 ? `${formatClock(slideLeft)} left` : `+${formatClock(-slideLeft)} over`
  const deltaText = Math.abs(delta) < 30 ? 'on time' : delta > 0 ? `${formatClock(delta)} behind` : `${formatClock(-delta)} ahead`
  const deltaColor = Math.abs(delta) < 30 ? '#888' : delta > 0 ? '#f28b82' : '#81c995'
  const pill = { ...S.btn, minWidth: '40px', height: '40px', padding: '0 10px', fontSize: '15px' }
  const notesHtml = note
    ? marked.parse(renderCitations(note).markdown)
    : '<p>No notes — add a <code>:::notes</code> block to the slide.</p>'
  const notesDir = textDirection(deckConfig.lang) === 'rtl' ? 'rtl' : undefined

  // Reactions from the phones float up here, never on the projector.
  const reacting = !!reactionsOf(deckConfig)
  const summaryPanel = summary && <RehearsalSummary
    slides={slides}
    plan={plan}
    spent={summary}
    onClose={() => { setSummary(null); timer.toggle() }}
    onDiscard={() => { setSummary(null); timer.endRehearsal() }}
    onSaved={(times, changed) => {
      setSummary(null)
      timer.endRehearsal()
      setSavedTimes(saved => ({ ...saved, ...Object.fromEntries(Object.entries(times).map(([id, t]) => [id, t ?? undefined])) }))
      setSavedNote(`Saved the times of ${changed} slide${changed === 1 ? '' : 's'} into the deck.`)
      setTimeout(() => setSavedNote(null), 6000)
    }}
  />

  const themeModal = <ThemePicker theme={theme} palette={palette} appearance={appearance} index={index} onPick={setTheme} onClose={() => setThemeModalOpen(false)} />
  // The controls, the same in every layout (PresenterChrome.jsx); the layouts
  // differ in where they put them.
  const frame = () => iframeRef.current?.contentWindow
  const problem = unpaired ? UNPAIRED[unpaired] : hasActivities() && steering && !steering.ok ? STEERING[steering.reason] : null
  const slideBar = big => <SlideControls controls={slideControls} press={i => sendTo(frame(), 'slideControl', i)} zoom={key => sendTo(frame(), 'hotspotKey', key)} big={big} />
  // The audience window, one click away (not on a phone: it would open there).
  const audienceButton = <ToolButton class="presenter-audience" icon="projector" label={audienceConnected ? 'Open the audience window again' : 'Open the audience window, for the projector'} onClick={openAudienceWindow} />
  const connections = <Connections presence={presence} phones={hasActivities()} problem={problem} />
  const timerChip = <button class="presenter-clock" title={timer.running ? 'Pause the timer (T)' : 'Start the timer (T)'} aria-pressed={timer.running} onClick={timer.toggle}
    style={{ ...tool, gap: '8px', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', color: timer.running ? '#f0f0f0' : '#777' }}>
    <Icon name={timer.running ? 'pause' : 'play'} size={14} style={{ display: 'block' }} />{clock}
    {timed && !remoteLayout && <span class="presenter-slide-time" style={{ color: slideColor, fontSize: '12px' }}>{slideText}</span>}
  </button>
  const finishButton = timer.rehearsing && <button class="presenter-rehearsing" style={{ ...tool, color: '#f28b82' }} title="Finish the rehearsal" onClick={finishRehearsal}>● Finish</button>
  const nav = <>
    <ToolButton icon="prev" label="Previous (←)" onClick={() => navCommand('prev')} />
    <ToolButton icon="next" label="Next (→, Space)" onClick={() => navCommand('next')} />
  </>
  const drawButton = <ToolButton class="presenter-draw" icon="pen" label="Draw on the slide (D)" pressed={inking} style={inking ? { background: '#e11d48', borderColor: '#e11d48', color: '#fff' } : undefined} onClick={() => sendTo(frame(), 'ink', 'toggle')} />
  const blankButton = <ToolButton class="presenter-blank" icon="blank" label={blankLabel} pressed={blank} onClick={toggleBlank} />
  const freezeButton = <ToolButton class="presenter-freeze" icon="freeze" label={freeze ? 'Let the audience follow again (Z)' : 'Freeze the slide the audience sees (Z)'} pressed={!!freeze} onClick={() => sendTo(frame(), 'freeze', 'toggle')} />
  // Only where phones join: decks with activities or reactions.
  const joinButton = (hasActivities() || reacting) && <ToolButton class="presenter-join" icon="join" label={join ? 'Hide the join code (J)' : 'Show the join code on the slide (J)'} pressed={join} onClick={() => sendTo(frame(), 'join', 'toggle')} />
  const overviewButton = <ToolButton class="presenter-overview" icon="overview" label="All slides (O)" pressed={overviewOpen} onClick={toggleOverview} />
  const hotspotsButton = <ToolButton class="presenter-hotspots" icon="hotspots" label={hotspotsOn ? 'Hotspots on: 1–9 zoom in (H)' : 'Hotspots off (H)'} pressed={hotspotsOn} onClick={toggleHotspots} />
  const fullscreenButton = canFullscreen && <ToolButton class="presenter-fullscreen" icon={fullscreenIcon} label={fullscreenLabel} pressed={isFullscreen} onClick={() => fullscreen.toggle()} />
  const helpButton = <ToolButton class="presenter-help" icon="guides" label="All keys (?)" onClick={() => setHelpOpen(open => !open)} />
  const separator = <span aria-hidden="true" style={{ width: '1px', alignSelf: 'stretch', margin: '6px 4px', background: '#2a2a2a' }} />
  const settings = <Settings layout={layout} onLayout={chooseLayout} duringTalk={remoteLayout && <>{freezeButton}{overviewButton}{hotspotsButton}{fullscreenButton}</>}
    theme={theme} themeMeta={themeMeta} onThemes={() => setThemeModalOpen(true)} offered={offered} shown={shown} setPalette={setPalette} setAppearance={setAppearance}
    lang={lang} setLang={setLang} timer={timer} noteSize={noteSize} setNoteSize={setNoteSize} launchPage={launchPage} />
  const notesBox = <div class="notes-md" dir={notesDir} style={{ flex: 1, minHeight: 0, overflow: 'auto', margin: 0, padding: '12px 14px', lineHeight: 1.55, background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '8px', fontSize: `${noteSize}px`, color: note ? '#c8c8c8' : '#3a3a3a' }}
    dangerouslySetInnerHTML={{ __html: notesHtml }} />
  const nextTitle = hasNext ? `Next: ${slideTitleOf(slides[index + 1]) || `slide ${index + 2}`}` : 'Last slide'
  const schedule = timed && <div class="presenter-schedule" style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
    <span>Slide <span class="presenter-slide-time" style={{ color: slideColor }}>{slideText}</span>{planned ? <span style={{ color: '#555' }}> of {formatClock(planned)}</span> : null}</span>
    <span><span class="presenter-delta" style={{ color: deltaColor }}>{deltaText}</span><span style={{ color: '#555' }}> · of {formatClock(plan.total)}</span></span>
  </div>
  const rehearsing = timer.rehearsing && <div class="presenter-rehearsing" role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, padding: '6px 10px', borderRadius: '8px', border: '1px solid #5c2b28', color: '#f28b82' }}>
    <span>● Rehearsing{timer.running ? '' : ' (paused)'}: this slide {formatClock(Math.floor(timer.slideElapsed))}</span>
    <button style={{ ...S.btn, padding: '2px 10px' }} onClick={finishRehearsal}>Finish</button>
  </div>
  const noteStyle = { position: 'fixed', left: layout === 'speaker' ? 'calc(100% / 3)' : '50%', bottom: remoteLayout ? '110px' : '76px', transform: 'translateX(-50%)', zIndex: 18, display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '999px', background: 'rgba(17,17,17,0.92)', border: '1px solid #3a3a3a', color: '#f0f0f0', fontFamily: 'ui-sans-serif, system-ui, sans-serif', fontSize: '14px', pointerEvents: 'none' }
  const blankNote = blank && <div class="presenter-blank-note" role="status" style={noteStyle}>
    <PresenterIcon name="blank" size={16} />The audience sees a black screen
  </div>
  // Frozen: says which slide the audience still sees (the black screen says more).
  const freezeNote = !blank && freeze && <div class="presenter-freeze-note" role="status" style={noteStyle}>
    <PresenterIcon name="freeze" size={16} />{freeze.index === index ? 'Frozen: the audience keeps this slide' : `Frozen: the audience sees slide ${freeze.index + 1}`}
  </div>
  const unpairedNote = unpaired && <div class="presenter-unpaired" role="alert" style={{ position: 'fixed', left: layout === 'speaker' ? 'calc(100% / 3)' : '50%', top: slideLayout && pillBottom ? `${pillBottom + 8}px` : '12px', transform: 'translateX(-50%)', zIndex: 18, maxWidth: 'calc(100vw - 32px)', boxSizing: 'border-box', padding: '8px 14px', borderRadius: '12px', background: 'rgba(17,17,17,0.94)', border: '1px solid #5c2b28', color: '#f28b82', fontFamily: 'ui-sans-serif, system-ui, sans-serif', fontSize: '14px', pointerEvents: 'none' }}>
    {UNPAIRED[unpaired]}
  </div>
  const font = { fontFamily: 'ui-sans-serif, system-ui, sans-serif', fontSize: '13px', color: '#ccc' }
  const extras = <>
    {unpairedNote}
    {blankNote}
    {freezeNote}
    {reacting && <Reactions style={remoteLayout ? { left: '16px', bottom: '100px' } : undefined} />}
    {helpOpen && <KeyHelp
      context={{ view: 'presenter', blank, frozen: !!freeze, join: hasActivities() || reacting, joinShown: join, overview: overviewOpen, hotspots: slideHotspots, hotspotSwitch: hotspotsOn, inking, fullscreen: canFullscreen, drawer: slideLayout, languages: LANGUAGES.length > 0 }}
      onClose={() => setHelpOpen(false)}
    />}
    {summaryPanel}
    {themeModalOpen && themeModal}
  </>

  // A phone in the hand: the slide small at the top, what can be done on it,
  // the notes, and the buttons to go on and back where the thumb is.
  if (remoteLayout) {
    const big = { ...S.btn, height: '72px', fontSize: '18px', fontWeight: 600, borderRadius: '14px' }
    return (
      <div class="presenter presenter--remote" style={{ ...font, fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '10px', height: '100dvh', boxSizing: 'border-box', padding: 'max(10px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left))', background: '#111', overflow: 'hidden', touchAction: 'manipulation' }}>
        <style>{SLIM_REMOTE_BAR}</style>
        <div class="presenter-remote-bar" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: '6px', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
          <SlideJump index={index} total={slides.length} onJump={i => navCommand('goTo', i)} style={{ color: '#888', whiteSpace: 'nowrap' }} />
          <span style={{ flex: 1 }} />
          {finishButton}{timerChip}{joinButton}{blankButton}{connections}{settings}
        </div>
        <div style={{ position: 'relative', flexShrink: 0, width: '100%', maxHeight: '32dvh', aspectRatio: '16/9', margin: '0 auto', borderRadius: '8px', overflow: 'hidden', border: '1px solid #2a2a2a', background: '#000' }}>
          <iframe ref={iframeRef} title="Presenter deck" src={iframeSrc} style={{ width: '100%', height: '100%', border: '0', display: 'block' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexShrink: 0, fontSize: '13px', color: '#888', fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nextTitle}</span>
          {timed && <span style={{ flexShrink: 0 }}><span class="presenter-slide-time" style={{ color: slideColor }}>{slideText}</span> · <span class="presenter-delta" style={{ color: deltaColor }}>{deltaText}</span></span>}
        </div>
        {savedNote && <div role="status" style={{ flexShrink: 0, color: '#81c995' }}>{savedNote}</div>}
        {slideBar(true)}
        {notesBox}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px', flexShrink: 0 }}>
          <button class="presenter-remote-prev" style={big} aria-label="Previous" onClick={() => navCommand('prev')}><PresenterIcon name="prev" size={28} /></button>
          <button class="presenter-remote-next" style={{ ...big, background: '#f0f0f0', borderColor: '#f0f0f0', color: '#111' }} aria-label="Next" onClick={() => navCommand('next')}>Next<PresenterIcon name="next" size={28} /></button>
        </div>
        {extras}
      </div>
    )
  }

  // The next slide and the notes: the speaker layout's column, the iPad's drawer.
  const aside = <aside class="presenter-aside" style={{
    ...font, display: slideLayout && !drawerOpen ? 'none' : 'flex', flexDirection: 'column', gap: '12px', padding: '14px', boxSizing: 'border-box',
    borderLeft: '1px solid #2a2a2a', background: '#111', overflow: 'hidden', minHeight: 0,
    ...(slideLayout ? { position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(400px, 92vw)', zIndex: 19, paddingTop: '68px', boxShadow: '-12px 0 32px rgba(0,0,0,0.5)' } : {}),
  }}>
    {!slideLayout && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
      <SlideJump index={index} total={slides.length} pad={2} onJump={i => navCommand('goTo', i)} style={{ color: '#888', fontVariantNumeric: 'tabular-nums' }} />
      <span style={{ flex: 1 }} />
      {finishButton}{timerChip}{audienceButton}{connections}{settings}
    </div>}
    {slideLayout && <span style={{ display: 'none' }}><SlideJump index={index} total={slides.length} pad={2} onJump={i => navCommand('goTo', i)} /></span>}
    {schedule}
    {rehearsing}
    {savedNote && <div role="status" style={{ flexShrink: 0, color: '#81c995' }}>{savedNote}</div>}
    {hasNext ? <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
      <div style={{ width: '46%', flexShrink: 0, aspectRatio: '16/9', borderRadius: '6px', overflow: 'hidden', border: '1px solid #2a2a2a', background: '#000' }}>
        <iframe ref={previewRef} title="Next slide preview" src={previewSrc} scrolling="no" style={{ width: '100%', height: '100%', border: '0', pointerEvents: 'none' }} />
      </div>
      <span style={{ color: '#888', lineHeight: 1.4 }}>{nextTitle}</span>
    </div> : <span style={{ color: '#666', flexShrink: 0 }}>Last slide</span>}
    {notesBox}
  </aside>

  // The iPad: the slide as large as it fits below one slim bar on top, which
  // is a little smaller than a computer's; the drawing toolbar keeps its own
  // strip below it (the stage's data-ink-reserve).
  const slideTop = pillBottom ? pillBottom + 4 : 0
  if (slideLayout) return (
    <div ref={pageRef} class="presenter presenter--slide" style={{ position: 'relative', height: pageHeight ? `${pageHeight}px` : '100dvh', background: '#111', overflow: 'hidden', touchAction: 'pan-x pan-y' }}>
      <style>{SLIM_PILL}</style>
      <iframe ref={iframeRef} title="Presenter deck" src={iframeSrc} style={{ position: 'absolute', top: `${slideTop}px`, left: 0, width: '100%', height: `calc(100% - ${slideTop}px)`, border: '0', display: 'block' }} />
      <div ref={pillRef} class="presenter-pill" role="toolbar" aria-label="Presenter" style={{ ...font, position: 'absolute', top: 'max(6px, env(safe-area-inset-top))', right: 'max(10px, env(safe-area-inset-right))', zIndex: 20, display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 'calc(100vw - 20px)', padding: '4px', borderRadius: '14px', background: 'rgba(17,17,17,0.9)', border: '1px solid #2a2a2a', fontVariantNumeric: 'tabular-nums' }}>
        <SlideJump index={index} total={slides.length} onJump={i => navCommand('goTo', i)} style={{ padding: '0 4px', color: '#888' }} />
        {finishButton}{timerChip}
        {separator}{nav}
        {separator}{drawButton}{blankButton}{freezeButton}{joinButton}{overviewButton}{hotspotsButton}
        {(slideControls.items.length > 0 || slideControls.hotspots > 0) && <>{separator}{slideBar(false)}</>}
        {separator}
        <ToolButton class="presenter-notes" icon="file-text" label="Notes and the next slide (N)" pressed={drawerOpen} onClick={() => setDrawerOpen(open => !open)} />
        {fullscreenButton}{audienceButton}{helpButton}{connections}{settings}
      </div>
      {aside}
      {extras}
    </div>
  )

  // A computer: the slide with its toolbar, the time, next slide and notes beside it.
  return (
    <div class="presenter presenter--speaker" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', height: '100dvh', background: '#111', overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
        <iframe ref={iframeRef} title="Presenter deck" src={iframeSrc} style={{ flex: 1, minHeight: 0, width: '100%', border: '0', display: 'block' }} />
        <div class="presenter-toolbar" role="toolbar" aria-label="Presenter" style={{ ...font, display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', padding: '8px 12px', borderTop: '1px solid #2a2a2a', background: '#111' }}>
          {nav}
          {separator}{drawButton}{blankButton}{freezeButton}{joinButton}{overviewButton}{hotspotsButton}{fullscreenButton}
          {(slideControls.items.length > 0 || slideControls.hotspots > 0) && <>{separator}<span style={{ ...S.label, marginBottom: 0, marginInlineEnd: '4px' }}>This slide</span>{slideBar(false)}</>}
          <span style={{ flex: 1 }} />
          {helpButton}
        </div>
      </div>
      {aside}
      {extras}
    </div>
  )
}

// The presenter view fills this window; its slide frame is the deck.
export function startPresenter({ deckConfig, slides }) {
  actAsPresenter()
  // A tool of mdeck's, like the launch page: its mark in the tab.
  const icon = document.querySelector('link[rel=icon]') ?? document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'icon' }))
  icon.href = mdeckMark
  followPresence()
  document.body.style.margin = '0'
  const s = document.createElement('style')
  s.textContent = `
    .notes-md p { margin: 0 0 6px; }
    .notes-md p:last-child { margin-bottom: 0; }
    .notes-md ul, .notes-md ol { margin: 0 0 6px; padding-inline-start: 1.4em; }
    .notes-md li { margin-bottom: 2px; }
    .notes-md strong, .notes-md b { color: #f0f0f0; font-weight: 600; }
    .notes-md em, .notes-md i { font-style: italic; color: #bbb; }
    .notes-md code { direction: ltr; unicode-bidi: isolate; font-family: ui-monospace, monospace; font-size: 0.9em; background: #222; padding: 1px 4px; border-radius: 3px; }
    .notes-md a { color: #aaa; }
  `
  document.head.appendChild(s)
  render(<PresenterView deckConfig={deckConfig} slides={slides} />, document.body)
}
