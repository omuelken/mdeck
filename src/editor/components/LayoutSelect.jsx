import { h } from 'preact'
import { parseSlides } from '../../core/parseSlides.js'
import { setSlideMeta, setRegion } from '../../core/editDeck.js'
import { Field } from './Field.jsx'

export function LayoutSelect({ slide, manifests, slideEdit }) {
  const current = slide.meta.layout ?? 'generic'
  const manifest = manifests.templates[current]
  const missing = Object.entries(manifest?.regions ?? {}).filter(([name, region]) => region.required && !slide.regions[name]?.content.trim()).map(([name]) => name)
  const known = Object.hasOwn(manifests.templates, current)
  const addMissing = () => slideEdit((deck, id) => {
    let source = deck.source
    for (const name of missing) source = setRegion(parseSlides(source), id, name, '')
    return source
  })
  return <Field label="Layout" hint={manifest?.description} error={known ? null : `Unknown layout "${current}"; the content renders with the plain layout`}>
    <div class="row">
      <select value={current} onChange={event => { const layout = event.currentTarget.value; slideEdit((deck, id) => setSlideMeta(deck, id, { layout: layout === 'generic' ? undefined : layout })) }}>
        {!known && <option value={current}>{current}</option>}
        {Object.values(manifests.templates).map(template => <option key={template.id} value={template.id}>{template.title}</option>)}
      </select>
      {missing.length > 0 && <button class="btn is-small" onClick={addMissing} title={`Add ${missing.join(', ')}`}>Add areas</button>}
    </div>
  </Field>
}
