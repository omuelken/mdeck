import { h } from 'preact'
import { slideDiagnostics } from '../model.js'
import { LayoutSelect } from './LayoutSelect.jsx'
import { RegionEditor } from './RegionEditor.jsx'
import { PropsForm } from './PropsForm.jsx'
import { MetaFields } from './MetaFields.jsx'
import { RawSlideEditor } from './RawSlideEditor.jsx'
import { Diagnostics } from './Diagnostics.jsx'

export function Inspector({ state, dispatch, edit }) {
  const { deck, manifests, selectedIndex, inspectorMode, diagnostics } = state
  const slide = deck.slides[selectedIndex]
  if (!slide) return <div class="form"><p class="empty">Select a slide to edit it.</p></div>
  // Helpers receive the slide as it exists when the edit is applied, so ids
  // shifted by earlier edits never go stale.
  const slideEdit = (fn, options = {}) => edit(d => { const current = d.slides[selectedIndex]; return current ? fn(d, current.id, current) : d.source }, { ...options, group: options.group ? `${options.group}:${selectedIndex}` : undefined })
  const manifest = manifests.layouts[slide.meta.layout ?? 'generic']
  const problems = slideDiagnostics(diagnostics, slide)
  return <>
    <div class="tabs">
      <button class={inspectorMode === 'form' ? 'is-active' : ''} onClick={() => dispatch({ type: 'setInspectorMode', mode: 'form' })}>Fields</button>
      <button class={inspectorMode === 'raw' ? 'is-active' : ''} onClick={() => dispatch({ type: 'setInspectorMode', mode: 'raw' })}>Markdown</button>
    </div>
    <div class="form">
      <Diagnostics items={problems} />
      {inspectorMode === 'raw'
        ? <RawSlideEditor deck={deck} slide={slide} slideEdit={slideEdit} />
        : <>
          <LayoutSelect slide={slide} manifests={manifests} slideEdit={slideEdit} />
          <RegionEditor slide={slide} manifest={manifest} slideEdit={slideEdit} />
          <PropsForm slide={slide} manifest={manifest} slideEdit={slideEdit} />
          <MetaFields slide={slide} slideEdit={slideEdit} />
        </>}
    </div>
  </>
}
