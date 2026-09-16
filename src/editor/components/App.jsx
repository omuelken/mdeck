import { h } from 'preact'
import { useEffect, useMemo, useReducer, useRef, useState } from 'preact/hooks'
import { reduce, initialState } from '../state.js'
import { loadDeck, saveSource, onServerEvent } from '../api.js'
import { createSaveQueue } from '../saveQueue.js'
import { installShortcuts } from '../keyboard.js'
import { insertSlide, removeSlide, moveSlide, slideSourceText } from '../../core/editDeck.js'
import { Outline } from './Outline.jsx'
import { Preview } from './Preview.jsx'
import { Inspector } from './Inspector.jsx'
import { DeckSettings } from './DeckSettings.jsx'
import { TemplatePicker } from './TemplatePicker.jsx'
import { ConflictBanner } from './ConflictBanner.jsx'
import { ExtensionsMode } from './ExtensionsMode.jsx'
import { Resizer, readInspectorWidth, storeInspectorWidth } from './Resizer.jsx'
import markUrl from '../../../assets/logo/mark.svg'

const STATUS = { saved: 'Saved', unsaved: 'Unsaved changes', saving: 'Saving…', conflict: 'Conflict', error: 'Could not save' }

export function App() {
  const [state, dispatch] = useReducer(reduce, initialState)
  const stateRef = useRef(state)
  stateRef.current = state
  const [picker, setPicker] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [mode, setMode] = useState('slides')
  const [previewKey, setPreviewKey] = useState(0)
  const [inspectorWidth, setInspectorWidth] = useState(readInspectorWidth)
  const resize = width => { setInspectorWidth(width); storeInspectorWidth(width) }

  const queue = useMemo(() => createSaveQueue({
    save: saveSource,
    onSaving: () => dispatch({ type: 'saving' }),
    onSaved: info => dispatch({ type: 'saved', ...info }),
    onConflict: error => dispatch({ type: 'conflict', source: error.source, hash: error.hash }),
    onError: error => dispatch({ type: 'saveError', message: error.message }),
  }), [])

  const load = async () => {
    try {
      const payload = await loadDeck()
      dispatch({ type: 'load', ...payload })
      queue.setBase(payload.hash)
      setLoadError(null)
    } catch (error) { setLoadError(error.message) }
  }

  useEffect(() => {
    load()
    const offChanged = onServerEvent('mdeck:deck-changed', async ({ hash }) => {
      if (hash === stateRef.current.hash || hash === queue.base()) return
      try {
        const payload = await loadDeck()
        if (stateRef.current.status === 'saved') queue.setBase(payload.hash)
        dispatch({ type: 'externalChange', source: payload.source, hash: payload.hash })
      } catch {}
    })
    // Extension files changed on disk (by this editor or another program):
    // refresh the registry and reload the preview frame, never the page.
    const offExtensions = onServerEvent('mdeck:extensions-changed', async () => {
      try { const payload = await loadDeck(); dispatch({ type: 'setRegistry', registry: payload.registry }) } catch {}
      setPreviewKey(key => key + 1)
    })
    const flush = () => { if (queue.pending()) queue.flush() }
    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush() })
    return () => { offChanged(); offExtensions(); window.removeEventListener('beforeunload', flush) }
  }, [])

  useEffect(() => { if (state.loaded && state.status === 'unsaved') queue.push(state.source) }, [state.source, state.status, state.loaded])

  const edit = (apply, options = {}) => dispatch({ type: 'edit', apply, ...options })
  const select = index => dispatch({ type: 'select', index })
  const actions = {
    undo: () => dispatch({ type: 'undo' }),
    redo: () => dispatch({ type: 'redo' }),
    prev: () => select(stateRef.current.selectedIndex - 1),
    next: () => select(stateRef.current.selectedIndex + 1),
    add: () => setPicker(true),
    remove: () => { const s = stateRef.current; const slide = s.deck?.slides[s.selectedIndex]; if (slide) edit(d => removeSlide(d, d.slides[s.selectedIndex].id)) },
    duplicate: () => { const s = stateRef.current; if (s.deck?.slides[s.selectedIndex]) edit(d => insertSlide(d, s.selectedIndex + 1, slideSourceText(d, d.slides[s.selectedIndex].id))) },
    move: delta => { const s = stateRef.current; if (s.deck?.slides[s.selectedIndex]) edit(d => moveSlide(d, d.slides[s.selectedIndex].id, s.selectedIndex + delta)) },
    pick: template => { const s = stateRef.current; edit(d => insertSlide(d, s.deck.slides.length ? s.selectedIndex + 1 : 0, template.starter)); setPicker(false) },
    resolve: choice => {
      const conflict = stateRef.current.conflict
      dispatch({ type: 'resolveConflict', choice })
      if (choice === 'overwrite') queue.overwrite(conflict.hash)
      else queue.reload(conflict.hash)
    },
  }
  useEffect(() => installShortcuts(actions), [])

  if (loadError) return <div class="loading">Could not load the deck: {loadError}</div>
  if (!state.loaded) return <div class="loading">Loading…</div>
  const { deck, selectedIndex, tab } = state
  const slide = deck.slides[selectedIndex]
  const selection = { index: selectedIndex, slideId: slide?.id ?? null }
  const stateWithPreview = { ...state, previewKey }

  return <div class="editor">
    <header class="editor-topbar">
      <img src={markUrl} alt="" width="22" height="22" style={{ borderRadius: '5px' }} />
      <h1 title={state.path}>{state.name}</h1>
      <span class="editor-chip" title="The editor is new. It saves only what you change, but keep a copy of decks you care about.">Experimental</span>
      <span class={`editor-status is-${state.status}`}>{STATUS[state.status]}{state.error ? `: ${state.error}` : ''}</span>
      <span class="spacer" />
      <div class="tabs" style={{ padding: 0, border: 0, position: 'static' }}>
        <button class={mode === 'slides' ? 'is-active' : ''} onClick={() => setMode('slides')}>Slides</button>
        <button class={mode === 'extensions' ? 'is-active' : ''} onClick={() => setMode('extensions')}>Palettes, themes & templates</button>
      </div>
      <span class="spacer" />
      <button class="btn is-small" onClick={actions.undo} disabled={!state.history.past.length} title="Undo (⌘Z)">Undo</button>
      <button class="btn is-small" onClick={actions.redo} disabled={!state.history.future.length} title="Redo (⇧⌘Z)">Redo</button>
      <a class="btn is-small" href="/?presenter=1" target="_blank" rel="noopener">Present</a>
      <a class="btn is-small" href="/" target="_blank" rel="noopener">Open deck</a>
    </header>
    {state.status === 'conflict' && <ConflictBanner onReload={() => actions.resolve('reload')} onOverwrite={() => actions.resolve('overwrite')} />}
    <div class="editor-main" style={{ gridTemplateColumns: `240px minmax(0, 1fr) ${inspectorWidth}px` }}>
      {mode === 'extensions' ? <ExtensionsMode state={stateWithPreview} dispatch={dispatch} previewReload={() => setPreviewKey(key => key + 1)} onResize={resize} /> : <>
      <Outline deck={deck} manifests={state.manifests} diagnostics={state.diagnostics} selectedIndex={selectedIndex}
        onSelect={select} onAdd={actions.add} onDuplicate={actions.duplicate} onRemove={actions.remove} onMove={actions.move} />
      <Preview source={state.source} selection={selection} reloadKey={previewKey} width={deck.deckConfig.width ?? 1920} height={deck.deckConfig.height ?? 1080}
        onState={index => { if (index !== stateRef.current.selectedIndex) select(index) }}
        onRendered={info => dispatch({ type: 'previewRendered', ...info })} />
      <aside class="editor-panel">
        <Resizer onResize={resize} />
        <div class="tabs">
          <button class={tab === 'slide' ? 'is-active' : ''} onClick={() => dispatch({ type: 'setTab', tab: 'slide' })}>Slide</button>
          <button class={tab === 'deck' ? 'is-active' : ''} onClick={() => dispatch({ type: 'setTab', tab: 'deck' })}>Deck</button>
        </div>
        {tab === 'deck' ? <DeckSettings state={state} edit={edit} /> : <Inspector state={state} dispatch={dispatch} edit={edit} />}
      </aside>
      </>}
    </div>
    {picker && <TemplatePicker templates={state.manifests.templates} onPick={actions.pick} onClose={() => setPicker(false)} />}
  </div>
}
