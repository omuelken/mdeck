import { h } from 'preact'
import { useState } from 'preact/hooks'
import { Icon } from '../../components/Icon.jsx'
import { slideTitle, slideDiagnostics, dropTarget } from '../model.js'

export function Outline({ deck, manifests, diagnostics, selectedIndex, onSelect, onAdd, onDuplicate, onRemove, onMove, onReorder, onToggleHidden }) {
  const count = deck.slides.length
  const [drag, setDrag] = useState(null) // { from, gap }
  const end = () => setDrag(null)
  const over = (event, index) => {
    if (!drag) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const box = event.currentTarget.getBoundingClientRect()
    const gap = event.clientY < box.top + box.height / 2 ? index : index + 1
    if (gap !== drag.gap) setDrag({ ...drag, gap })
  }
  const drop = event => {
    event.preventDefault()
    const to = drag && drag.gap != null ? dropTarget(drag.from, drag.gap) : null
    end()
    if (to != null) onReorder(drag.from, to)
  }
  return <aside class="editor-panel">
    <div class="editor-panel-head"><span>Slides</span><button class="btn is-small is-primary" onClick={onAdd} title="Add a slide after the selected one (⌘↩)"><Icon name="add" size={14} />Add</button></div>
    {count === 0 && <p class="empty">No slides yet. Add one to get started.</p>}
    <ol class="outline-list" onDragLeave={event => { if (drag && !event.currentTarget.contains(event.relatedTarget)) setDrag({ ...drag, gap: null }) }}>
      {deck.slides.map((slide, index) => {
        const manifest = manifests.layouts[slide.meta.layout ?? 'generic']
        const errors = slideDiagnostics(diagnostics, slide).some(d => d.severity === 'error')
        const gapClass = drag && drag.gap != null && dropTarget(drag.from, drag.gap) != null
          ? drag.gap === index ? ' is-drop-before' : drag.gap === index + 1 && index === count - 1 ? ' is-drop-after' : ''
          : ''
        const hidden = slide.meta.hidden === true
        return <li key={index} class={`outline-item${index === selectedIndex ? ' is-selected' : ''}${hidden ? ' is-hidden' : ''}${drag?.from === index ? ' is-dragging' : ''}${gapClass}`}
          draggable={count > 1} title={count > 1 ? 'Drag to reorder' : undefined} onClick={() => onSelect(index)}
          onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(index)); setDrag({ from: index, gap: null }) }}
          onDragOver={event => over(event, index)} onDrop={drop} onDragEnd={end}>
          <span class="num">{String(index + 1).padStart(2, '0')}</span>
          <span><span class="title" style={{ display: 'block' }}>{slideTitle(slide, index, manifest)}</span><span class="layout">{manifest?.title ?? slide.meta.layout ?? 'content'}</span></span>
          <span class="outline-marks">
            {errors && <span class="dot" title="This slide has errors" />}
            <button class="outline-hide" onClick={event => { event.stopPropagation(); onToggleHidden(index) }}
              title={hidden ? 'Hidden in the talk; click to show it again' : 'Hide in the talk (the slide stays in the deck)'} aria-label={hidden ? 'Show in the talk' : 'Hide in the talk'} aria-pressed={hidden}>
              <Icon name={hidden ? 'eye-off' : 'eye'} size={14} />
            </button>
          </span>
        </li>
      })}
    </ol>
    {count > 0 && <div class="outline-tools">
      <button class="btn is-small is-icon" onClick={() => onMove(-1)} disabled={selectedIndex <= 0} title="Move up" aria-label="Move up"><Icon name="up" size={14} /></button>
      <button class="btn is-small is-icon" onClick={() => onMove(1)} disabled={selectedIndex >= count - 1} title="Move down" aria-label="Move down"><Icon name="down" size={14} /></button>
      <button class="btn is-small" onClick={onDuplicate} title="Duplicate">Duplicate</button>
      <button class="btn is-small" onClick={onRemove} title="Remove (⌘⌫). Undo with ⌘Z">Remove</button>
    </div>}
  </aside>
}
