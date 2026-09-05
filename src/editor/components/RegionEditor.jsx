import { h } from 'preact'
import { setRegion, removeRegion } from '../../core/editDeck.js'
import { regionsFor } from '../model.js'
import { Field, TextArea } from './Field.jsx'

export function RegionEditor({ slide, manifest, slideEdit }) {
  const regions = regionsFor(slide, manifest)
  return <>
    {regions.map(region => <Field key={region.name} label={region.name === 'body' ? 'Content' : region.name} required={region.required && !region.content.trim()}
      hint={region.unknown ? 'not part of this layout' : region.description}>
      <TextArea rows={region.name === 'body' ? 8 : 5} value={region.content} onInput={text => slideEdit((deck, id) => setRegion(deck, id, region.name, text), { group: `region:${region.name}` })} />
      {region.unknown && <div><button class="btn is-small" onClick={() => slideEdit((deck, id) => removeRegion(deck, id, region.name))}>Remove this area</button></div>}
    </Field>)}
  </>
}
