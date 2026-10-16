// Every view but the presenter's: a deck window, the presenter view's slide
// frame and next-slide preview, the audience window, a phone following the
// talk, the reader, and the editor's preview. Which one this is comes from
// the address (main.jsx).
import { h, render } from 'preact'
import { onBibliography } from './citations.js'
import { parseSlides } from '../core/parseSlides'
import { validateDeck } from '../core/validateDeck'
import { loadTheme, setExtensionOverrides } from './themeLoader'
import { createEditorBridge } from './editorBridge.js'
import { ReaderView } from './ReaderView.jsx'
import { createOrder } from './syncOrder.js'
import { attachInk, watchInk } from './ink/attach.js'
import { roomTransport, followStageRoom, announceStagePosition, onStagePosition } from './ink/room.js'
import { startFollowing } from './follow.js'
import { inkFileName } from 'virtual:deck-ink'
import { manifests } from '../layouts/renderSlide'
import { setCalloutLabels } from './markedSetup'
import { setDeckLanguage, deckLanguage, t } from '../core/labels.js'
import { watchSlideControls, pressSlideControl } from './slideControls.js'
import { attachKeyHelp } from './KeyHelp.jsx'
import { isHelpKey } from './helpKeys.js'
import { reactionsOf } from '../core/reactions.js'
import { slidesContent, deckLang, LANGUAGES, chooseLanguage, withFileLanguage, withConfigOverrides } from './deckSource.js'
import { hasActivities, announceSlide } from './phones.js'
import { DECK_CHANNEL } from './deckChannel.js'
import { mountDeck } from './mountDeck.jsx'
import { JoinOverlay } from './JoinOverlay.jsx'

// An audience window says it is there this often, and counts as gone when
// it has not said so for this long (or says so as it closes).
const SCREEN_SAY_MS = 3000
const SCREEN_GONE_MS = 8000

const toParent = message => window.parent.postMessage(message, window.location.origin)

// A command from the presenter view (postMessage to its frames,
// BroadcastChannel to the audience window) or the editor.
function handleDeckControl(ctrl, { drawHere, switchLanguage }) {
  if (!ctrl) return
  const stage = document.querySelector('deck-stage')
  if (!stage) return
  if (ctrl.command === 'next') stage.next()
  else if (ctrl.command === 'prev') stage.prev()
  else if (ctrl.command === 'reset') stage.reset()
  else if (ctrl.command === 'goTo' && Number.isInteger(ctrl.value)) stage.goTo(ctrl.value)
  else if (ctrl.command === 'setState') stage.setState(ctrl.value)
  else if (ctrl.command === 'setLanguage') switchLanguage(ctrl.value)
  else if (ctrl.command === 'ink' && drawHere) stage.inking = ctrl.value === 'toggle' ? !stage.inking : !!ctrl.value
  // Digits and Escape typed in the presenter view, and its hotspots switch.
  else if (ctrl.command === 'hotspotKey' && typeof ctrl.value === 'string') stage.hotspotKey(ctrl.value)
  else if (ctrl.command === 'hotspots') stage.hotspotsForced = ctrl.value
  // The phone clicker pressed one of the slide's controls.
  else if (ctrl.command === 'slideControl' && Number.isInteger(ctrl.value)) pressSlideControl(stage, ctrl.value)
  // B in the presenter view: the screens the audience sees go black.
  // O in the presenter view: the overview opens in its own slide frame.
  else if (ctrl.command === 'overview') stage.overview = ctrl.value === 'toggle' ? !stage.overview : !!ctrl.value
  else if (ctrl.command === 'overviewKey' && typeof ctrl.value === 'string') stage.overviewKey(ctrl.value)
  else if (ctrl.command === 'blank') stage.setBlank(ctrl.value === 'toggle' ? !stage.blank : !!ctrl.value, 'keyboard')
  // P in the presenter view: the audience's screens keep the slide shown.
  else if (ctrl.command === 'freeze') stage.setFreeze(ctrl.value === 'toggle' ? !stage.freeze : !!ctrl.value, 'keyboard')
  else if (ctrl.command === 'join') stage.setJoin(ctrl.value === 'toggle' ? !stage.join : !!ctrl.value, 'keyboard')
}

// Editor preview: the editor pushes whole sources; render best effort and
// report back. Bad decks never blank the preview here.
async function startEditorPreview(control) {
  const bridge = createEditorBridge({
    parse: parseSlides, validate: deck => validateDeck(deck, { layouts: manifests }), loadTheme, setExtensionOverrides,
    setCalloutLabels: config => { setCalloutLabels(config); setDeckLanguage(config); document.documentElement.lang = deckLanguage() },
    applyOverrides: withConfigOverrides, mount: context => mountDeck({ ...context, editor: true }), post: toParent,
  })
  window.addEventListener('message', event => {
    if (event.source !== window.parent || event.origin !== window.location.origin) return
    if (!bridge.handleMessage(event.data)) control(event.data?.deckControl)
  })
  // Saving the deck or its reference file reformats the citations.
  onBibliography(() => bridge.refresh())
  await bridge.render(slidesContent)
  toParent({ deckEditorReady: true })
}

// A quiet way into the reader view for anyone who opened the file directly.
function addReaderEntry() {
  const entry = document.createElement('a')
  entry.className = 'reader-entry'
  entry.href = '?view=reader'
  entry.textContent = t('deck.overview')
  document.body.appendChild(entry)
}

// Whether another screen shows the deck, so that a video played in the
// presenter view is silent there and its sound comes from that screen
// (components/VideoPlayer.jsx). The server says who is connected; an
// audience window also says so to the windows of its own browser, for a
// deck opened without a server (a built folder). Returns what the presenter's
// frame does with the server's word on who is connected.
function watchScreens(stage, { storageKey, audienceMode, embedded, drawHere }) {
  const screens = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(`mdeck-screens:${storageKey}`) : null
  let watchedOnServer = false, audienceHere = 0
  const markWatched = () => stage?.toggleAttribute('data-others-watching', watchedOnServer || Date.now() - audienceHere < SCREEN_GONE_MS)
  if (screens && audienceMode) {
    const say = message => screens.postMessage(message)
    say('audience')
    setInterval(() => say('audience'), SCREEN_SAY_MS)
    window.addEventListener('pagehide', () => say('gone'))
  } else if (screens && embedded && drawHere) {
    screens.onmessage = ({ data }) => { audienceHere = data === 'audience' ? Date.now() : 0; markWatched() }
    setInterval(markWatched, SCREEN_SAY_MS)
  }
  // The presenter's main frame tells the presenter view who is connected.
  return presence => {
    watchedOnServer = (presence?.views ?? []).some(entry => entry.view === 'audience' || entry.view === 'deck')
    markWatched()
    toParent({ presence })
  }
}

// The presenter view's slide frame: the hotspots' keys show (no screen the
// audience sees has them; a black screen only veils it), and it tells the
// presenter view what it needs to know.
function serveAsPresenterFrame(stage, { remoteFrame }) {
  // The phone remote's small slide only shows: no keys, no drawing.
  if (!remoteFrame) stage.setAttribute('data-hotspot-badges', '')
  stage.setAttribute('data-presenter', '')
  // The presenter view routes the keys to the overview while it is open.
  stage.addEventListener('overviewchange', event => toParent({ overview: event.detail.open }))
  // A frame that reloaded (another theme) has none open.
  toParent({ overview: false })
}

// ? typed in the presenter's slide frame goes to the presenter view, which
// shows the keys.
function forwardHelpKey() {
  window.addEventListener('keydown', event => {
    if (!isHelpKey(event) || event.target?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return
    event.preventDefault()
    toParent({ keyHelp: 'toggle' })
  })
}

// Drawing turns itself on, with the laser, where it is wanted: in the
// presenter view on a touch screen (an iPad), with the toolbar open in a
// strip of its own below the slide, and in a deck window as soon as a pen
// touches it, with the toolbar folded into its corner button. A phone or
// tablet only browsing the deck keeps its taps. D or the close button turns
// it off.
function startDrawingWhenWanted(stage, { embedded }) {
  const startDrawing = folded => { stage._inkCollapsed = folded; stage.inking = true }
  if (embedded && matchMedia('(pointer: coarse)').matches) {
    stage.setAttribute('data-ink-reserve', '')
    document.documentElement.style.background = '#000' // the toolbar's strip, as the stage
    startDrawing(false)
  }
  else if (!embedded) {
    const onPen = event => {
      if (event.pointerType !== 'pen') return
      window.removeEventListener('pointerdown', onPen, true)
      if (!stage.inking) startDrawing(true)
    }
    window.addEventListener('pointerdown', onPen, true)
  }
}

// Audience window receives commands via BroadcastChannel — reliable same-origin sync
// that doesn't depend on keeping a live cross-window reference
function followPresenterChannel(control) {
  const bc = new BroadcastChannel(DECK_CHANNEL)
  const order = createOrder()
  bc.onmessage = ({ data }) => {
    const ctrl = data?.deckControl
    if (!ctrl) return
    // A position older than this window's own last change is ignored.
    if (ctrl.command === 'setState' && !order.accept(ctrl.order)) return
    if (ctrl.command === 'setTheme') {
      loadTheme({ theme: ctrl.theme, palette: ctrl.palette || undefined, appearance: ctrl.appearance || undefined })
    } else {
      control(ctrl)
    }
  }
  document.querySelector('deck-stage')?.addEventListener('slidechange', event => {
    if (event.detail.reason === 'init') bc.postMessage({ audienceReady: true })
  })
  document.querySelector('deck-stage')?.addEventListener('statechange', event => {
    if (!['init', 'sync'].includes(event.detail.reason)) bc.postMessage({ deckStateChanged: event.detail, order: order.stamp() })
  })
  bc.postMessage({ audienceReady: true })
}

export async function startDeck({ url, parsed, deckConfig, editorMode, audienceMode, followMode, embedded, readerMode, drawHere }) {
  const inkStorageKey = `mdeck-ink:${inkFileName}:${location.pathname}`

  // The same slide and step in another language, its words and mdeck's own;
  // or `state`, where the screen that switched is: that screen tells the
  // others, not the ones that follow it. Says whether it switched.
  let announceLanguage = null
  function switchLanguage(lang, { state = document.querySelector('deck-stage')?.state, announce = true } = {}) {
    if (lang === deckLang || !chooseLanguage(lang)) return false
    const stage = document.querySelector('deck-stage')
    parsed = parseSlides(slidesContent)
    const config = withConfigOverrides(withFileLanguage(parsed.deckConfig))
    setCalloutLabels(config)
    setDeckLanguage(config)
    document.documentElement.lang = deckLanguage()
    // Explicit slide ids may differ between the files; the place does not.
    mountDeck({ deck: parsed, deckConfig: config })
    if (state) setTimeout(() => document.querySelector('deck-stage')?.setState({ ...state, slideId: undefined }), 0)
    if (!embedded && !followMode && stage) announceSlide(parsed, stage.index)
    if (announce) announceLanguage?.()
    if (embedded) toParent({ deckLanguage: lang })
    return true
  }
  const control = ctrl => handleDeckControl(ctrl, { drawHere, switchLanguage })

  if (editorMode) return startEditorPreview(control)

  if (readerMode) {
    document.body.style.margin = '0'
    await loadTheme(deckConfig)
    render(<ReaderView deck={parsed} deckConfig={deckConfig} />, document.body)
    return
  }

  await loadTheme(deckConfig)
  mountDeck({ deck: parsed, deckConfig })
  if (!embedded && !audienceMode && !followMode) addReaderEntry()

  // Drawing (D) in the full-screen deck and the presenter's main frame.
  const inkStage = document.querySelector('deck-stage')
  // The join code over the slide, on every screen but the next-slide preview;
  // J shows it in a deck phones join.
  if (inkStage && (hasActivities() || reactionsOf(deckConfig))) inkStage.setAttribute('data-joinable', '')
  if (inkStage && !(embedded && !drawHere)) {
    const host = document.createElement('div')
    host.className = 'join-overlay-host'
    document.body.appendChild(host)
    render(<JoinOverlay stage={inkStage} />, host)
  }
  // Main slide frames and audience windows both send and follow navigation.
  // Share their position connection with ink; previews stay on local channels.
  if (inkStage && (drawHere || audienceMode)) {
    followStageRoom(inkStage, { onLanguage: (lang, state) => switchLanguage(lang, { state, announce: false }) })
    announceLanguage = announceStagePosition(inkStage, { language: () => LANGUAGES.length ? deckLang : null })
  }
  const tellPresence = watchScreens(inkStage, { storageKey: inkStorageKey, audienceMode, embedded, drawHere })

  const remoteFrame = embedded && url.searchParams.get('remote') === '1'
  if (inkStage && embedded && drawHere) serveAsPresenterFrame(inkStage, { remoteFrame })
  // ? lists the keys that work now: in a deck window over the slide; in the
  // presenter's slide frame it goes to the presenter view, which shows them.
  if (inkStage && !embedded && !audienceMode && !followMode) attachKeyHelp(inkStage, { canDraw: drawHere })
  else if (embedded && drawHere) forwardHelpKey()
  // The presenter view shows the slide's own controls in its toolbar, the
  // clicker as big buttons (slideControls.js).
  if (inkStage && embedded && drawHere) watchSlideControls(inkStage, controls => toParent({ slideControls: controls }))

  if (inkStage && remoteFrame) {
    watchInk(inkStage, { storageKey: inkStorageKey, transports: [roomTransport({ receive: true, view: 'presenter', onPresence: tellPresence })] })
  } else if (inkStage && drawHere) {
    attachInk(inkStage, {
      storageKey: inkStorageKey,
      transports: [roomTransport({ receive: true, view: embedded ? 'presenter' : 'deck', onPresence: embedded ? tellPresence : null })],
      onMode: inking => { if (embedded) toParent({ inkMode: inking }) },
    })
    startDrawingWhenWanted(inkStage, { embedded })
  } else if (inkStage && followMode) {
    // The presenter's slide and ink, read from the stage room; counted as a phone.
    inkStage.setAttribute('data-follower', '')
    inkStage.setAttribute('data-watching', '')
    onStagePosition(position => {
      if (position.lang) switchLanguage(position.lang, { announce: false })
      if (typeof position.blank === 'boolean') inkStage.setBlank(position.blank, 'sync')
      if (typeof position.join === 'boolean') inkStage.setJoin(position.join, 'sync')
    })
    startFollowing(inkStage, { onStagePosition, words: { live: t('follow.live'), back: t('follow.back'), waiting: t('follow.waiting') } })
    watchInk(inkStage, { storageKey: inkStorageKey, transports: [roomTransport({ receive: true, view: 'phone' })] })
  } else if (inkStage && audienceMode) {
    // The audience window shows the presenter's zoom and a poll's answer, without their controls.
    inkStage.setAttribute('data-follower', '')
    // While the presenter freezes it (P), it keeps its slide.
    inkStage.setAttribute('data-freezable', '')
    watchInk(inkStage, { storageKey: inkStorageKey, transports: [roomTransport({ receive: true, view: 'audience' })] })
  } else if (inkStage) watchInk(inkStage, { storageKey: inkStorageKey })

  // A full deck or audience window is a presenter's screen; previews are
  // embedded, and a follower only watches.
  if (!embedded && !followMode) {
    const stage = document.querySelector('deck-stage')
    stage?.addEventListener('slidechange', event => announceSlide(parsed, event.detail.index, { initial: event.detail.reason === 'init' }))
    if (stage) announceSlide(parsed, stage.index, { initial: true })
  }

  // Embedded iframes (presenter view + preview pane) receive commands via postMessage
  window.addEventListener('message', event => {
    if (event.source === window.parent && event.origin === window.location.origin) control(event.data?.deckControl)
  })

  if (audienceMode) followPresenterChannel(control)
}
