import { h } from 'preact'
import { replaceSlideSource, slideSourceText } from '../../core/editDeck.js'
import { Field, TextArea } from './Field.jsx'

export function RawSlideEditor({ deck, slide, slideEdit }) {
  return <Field label="Slide Markdown" hint="everything between the --- lines">
    <TextArea tall rows={18} value={slideSourceText(deck, slide.id)} onInput={text => slideEdit((d, id) => replaceSlideSource(d, id, text), { group: 'raw' })} />
  </Field>
}
