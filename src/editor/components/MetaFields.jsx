import { h } from 'preact'
import { setSlideMeta, setSlideNotes } from '../../core/editDeck.js'
import { Field, TextArea } from './Field.jsx'

const MORE = [['section', 'Section label shown in the header'], ['number', 'Chapter number'], ['part', 'Part name for chapter slides'], ['label', 'Replaces the word "Chapter"'], ['description', 'Chapter description'], ['eyebrow', 'Small line above a heading'], ['attribution', 'Source of a quote']]

export function MetaFields({ slide, slideEdit }) {
  const meta = slide.authoredMeta
  const text = (key, numeric = false) => <input type={numeric ? 'number' : 'text'} value={meta[key] ?? ''} onInput={event => {
    const raw = event.currentTarget.value
    const value = raw === '' ? undefined : numeric && Number.isFinite(Number(raw)) ? Number(raw) : raw
    slideEdit((deck, id) => setSlideMeta(deck, id, { [key]: value }), { group: `meta:${key}` })
  }} />
  return <>
    <Field label="Slide id" hint="stable anchor and link target">{text('id')}</Field>
    <Field label="Speaker notes"><TextArea rows={4} value={slide.meta.notes ?? slide.meta.note ?? ''} onInput={value => slideEdit((deck, id) => setSlideNotes(deck, id, value), { group: 'notes' })} /></Field>
    <details class="more" open={MORE.some(([key]) => meta[key] != null)}>
      <summary>More metadata</summary>
      <div class="form">
        {MORE.map(([key, hint]) => <Field key={key} label={key} hint={hint}>{text(key, key === 'number')}</Field>)}
      </div>
    </details>
  </>
}
