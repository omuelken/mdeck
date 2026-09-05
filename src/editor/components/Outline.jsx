import { h } from 'preact'
import { slideTitle, slideDiagnostics } from '../model.js'

export function Outline({ deck, manifests, diagnostics, selectedIndex, onSelect, onAdd, onDuplicate, onRemove, onMove }) {
  const count = deck.slides.length
  return <aside class="editor-panel">
    <div class="editor-panel-head"><span>Slides</span><button class="btn is-small is-primary" onClick={onAdd} title="Add a slide after the selected one (⌘↩)">+ Add</button></div>
    {count === 0 && <p class="empty">No slides yet. Add one to get started.</p>}
    <ol class="outline-list">
      {deck.slides.map((slide, index) => {
        const manifest = manifests.templates[slide.meta.layout ?? 'generic']
        const errors = slideDiagnostics(diagnostics, slide).some(d => d.severity === 'error')
        return <li key={index} class={`outline-item${index === selectedIndex ? ' is-selected' : ''}`} onClick={() => onSelect(index)}>
          <span class="num">{String(index + 1).padStart(2, '0')}</span>
          <span><span class="title" style={{ display: 'block' }}>{slideTitle(slide, index, manifest)}</span><span class="layout">{manifest?.title ?? slide.meta.layout ?? 'content'}</span></span>
          {errors ? <span class="dot" title="This slide has errors" /> : <span />}
        </li>
      })}
    </ol>
    {count > 0 && <div class="outline-tools">
      <button class="btn is-small" onClick={() => onMove(-1)} disabled={selectedIndex <= 0} title="Move up">↑</button>
      <button class="btn is-small" onClick={() => onMove(1)} disabled={selectedIndex >= count - 1} title="Move down">↓</button>
      <button class="btn is-small" onClick={onDuplicate} title="Duplicate">Duplicate</button>
      <button class="btn is-small" onClick={onRemove} title="Remove (⌘⌫). Undo with ⌘Z">Remove</button>
    </div>}
  </aside>
}
