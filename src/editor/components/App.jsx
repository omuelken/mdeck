import { h } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { useDeckDocument } from '../useDeckDocument.js'
import { installShortcuts } from '../keyboard.js'
import { insertSlide, removeSlide, moveSlide, slideSourceText } from '../../core/editDeck.js'
import { Outline } from './Outline.jsx'
import { Preview } from './Preview.jsx'
import { Inspector } from './Inspector.jsx'
import { DeckSettings } from './DeckSettings.jsx'
import { LayoutPicker } from './LayoutPicker.jsx'
import { ConflictBanner } from './ConflictBanner.jsx'
import { Resizer, readInspectorWidth, storeInspectorWidth } from './Resizer.jsx'
import { designUrl, DESIGN_TAB, launchPageUrl } from '../designLink.js'
import markUrl from '../../../assets/logo/mark.svg'

const STATUS = { saved: 'Saved', unsaved: 'Unsaved changes', saving: 'Saving…', conflict: 'Conflict', error: 'Could not save' }

export function App() {
  const { state, stateRef, dispatch, edit, resolve, loadError, previewKey } = useDeckDocument()
  const [picker, setPicker] = useState(false)
  const [inspectorWidth, setInspectorWidth] = useState(readInspectorWidth)
  const resize = width => { setInspectorWidth(width); storeInspectorWidth(width) }
  const [home] = useState(launchPageUrl)

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
    pick: layout => { const s = stateRef.current; edit(d => insertSlide(d, s.deck.slides.length ? s.selectedIndex + 1 : 0, layout.starter)); setPicker(false) },
    resolve,
  }
  useEffect(() => installShortcuts(actions), [])

  if (loadError) return <div class="loading">Could not load the deck: {loadError}</div>
  if (!state.loaded) return <div class="loading">Loading…</div>
  const { deck, selectedIndex, tab } = state
  const slide = deck.slides[selectedIndex]
  const selection = { index: selectedIndex, slideId: slide?.id ?? null }

  return <div class="editor">
    <header class="editor-topbar">
      <img src={markUrl} alt="" width="22" height="22" style={{ borderRadius: '5px' }} />
      <h1 title={state.path}>{state.name}</h1>
      <span class={`editor-status is-${state.status}`}>{STATUS[state.status]}{state.error ? `: ${state.error}` : ''}</span>
      <span class="spacer" />
      <button class="btn is-small" onClick={actions.undo} disabled={!state.history.past.length} title="Undo (⌘Z)">Undo</button>
      <button class="btn is-small" onClick={actions.redo} disabled={!state.history.future.length} title="Redo (⇧⌘Z)">Redo</button>
      {home && <a class="btn is-small" href={home}>Launch page</a>}
      <a class="btn is-small" href={designUrl()} target={DESIGN_TAB} title="Make and change themes, palettes and layouts, on a sample deck">Design themes</a>
      <a class="btn is-small" href="/?view=presenter" target="_blank" rel="noopener">Present</a>
      <a class="btn is-small" href="/" target="_blank" rel="noopener">Open deck</a>
    </header>
    {state.status === 'conflict' && <ConflictBanner onReload={() => actions.resolve('reload')} onOverwrite={() => actions.resolve('overwrite')} />}
    <div class="editor-main" style={{ gridTemplateColumns: `240px minmax(0, 1fr) ${inspectorWidth}px` }}>
      <Outline deck={deck} manifests={state.manifests} diagnostics={state.diagnostics} selectedIndex={selectedIndex}
        onSelect={select} onAdd={actions.add} onDuplicate={actions.duplicate} onRemove={actions.remove} onMove={actions.move} />
      <Preview source={state.source} selection={selection} reloadKey={previewKey} total={deck.slides.length} width={deck.deckConfig.width ?? 1920} height={deck.deckConfig.height ?? 1080}
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
    </div>
    {picker && <LayoutPicker layouts={state.manifests.layouts} onPick={actions.pick} onClose={() => setPicker(false)} />}
  </div>
}
