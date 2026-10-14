// The page's entry: reads the deck, checks it, and starts the view the
// address asks for, the presenter view (presenter/) or one that shows the
// deck (deckWindow.jsx).
import { validatePageUrl } from '../core/urls.js'
import { parseSlides } from '../core/parseSlides'
import { validateDeck } from '../core/validateDeck'
import { configureLive, setSavedResults } from '../live/client.js'
import { claimPairing } from '../live/pairing.js'
import savedResults from 'virtual:deck-results'
import './reader.css'
import { manifests } from '../layouts/renderSlide'
import { setCalloutLabels } from './markedSetup'
import { setDeckLanguage, deckLanguage } from '../core/labels.js'
import { setView } from './shared.js'
import { reactionsOf } from '../core/reactions.js'
import { slidesContent, chooseLanguage, showSampleDeck, withFileLanguage, withConfigOverrides } from './deckSource.js'
import { wantReactions } from './phones.js'
import { requestedView } from './deckChannel.js'
import { injectSpeakerNotes } from './mountDeck.jsx'
import { startPresenter } from './presenter/PresenterView.jsx'
import { startDeck } from './deckWindow.jsx'

async function init() {
  // An iPad that opened the launch page's QR code pairs first.
  await claimPairing()
  const url = new URL(window.location.href)
  if (import.meta.env.DEV && url.searchParams.get('sample') === '1') {
    const { sampleDeck, sampleDataUrl } = await import('../editor/sampleDeck.js')
    showSampleDeck(sampleDeck(sampleDataUrl()))
  } else chooseLanguage(url.searchParams.get('lang'))
  const parsed = parseSlides(slidesContent)
  const editorMode = url.searchParams.get('editor') === '1'
  // One switch selects the view: deck, reader, presenter or audience.
  const defaultView = typeof __MDECK_DEFAULT_VIEW__ !== 'undefined' ? __MDECK_DEFAULT_VIEW__ : 'deck'
  const view = requestedView(url, defaultView)
  const errors = validateDeck(parsed, { layouts: manifests }).filter(d => d.severity === 'error')
  if (errors.length && !editorMode) {
    document.body.textContent = errors.map(d => `Line ${d.line}: ${d.message}`).join('\n')
    document.body.style.whiteSpace = 'pre-wrap'
    return
  }
  const deckConfig = withConfigOverrides(withFileLanguage(parsed.deckConfig))
  setCalloutLabels(deckConfig)
  setDeckLanguage(deckConfig)
  document.documentElement.lang = deckLanguage()
  configureLive(deckConfig)
  wantReactions(!!reactionsOf(deckConfig))
  setSavedResults(savedResults)
  const { slides } = parsed
  const presenterMode = view === 'presenter'
  const audienceMode  = view === 'audience'
  // A phone or laptop in the room following the talk: shows, never sends.
  const followMode = view === 'follow'
  const embedded = url.searchParams.get('embedded') === '1'
  const readerMode = view === 'reader' && !editorMode && !embedded
  // The deck window and the presenter's main frame draw; the audience window
  // and the next-slide preview show what is drawn.
  const drawHere = !audienceMode && !followMode && (!embedded || url.searchParams.get('draw') === '1')
  // What deck components learn from useView() (component.js).
  setView(audienceMode ? 'audience' : followMode ? 'follow' : readerMode ? 'reader' : embedded ? (drawHere && !editorMode ? 'presenter' : 'preview') : 'deck')

  injectSpeakerNotes(slides)
  if (presenterMode) startPresenter({ deckConfig, slides })
  else await startDeck({ url, parsed, deckConfig, editorMode, audienceMode, followMode, embedded, readerMode, drawHere })
}

const urlProblem = validatePageUrl(new URL(location.href))
if (urlProblem) {
  const message = document.createElement('p')
  message.textContent = urlProblem.message
  const panel = document.createElement('main')
  panel.style.cssText = 'font:16px/1.5 system-ui;max-width:48rem;margin:3rem auto;padding:2rem'
  panel.setAttribute('role', 'alert')
  panel.append(message)
  if (urlProblem.corrected) {
    const link = document.createElement('a')
    link.href = urlProblem.corrected
    link.textContent = 'Open updated address'
    panel.append(link)
  }
  document.body.replaceChildren(panel)
} else init()
