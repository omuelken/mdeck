import { h } from 'preact'
import { useState } from 'preact/hooks'
import { resolveTemplateProps, propertyErrors } from '../../templates/templateProps.js'
import { setSlideMeta } from '../../core/editDeck.js'
import { fieldKind, parseFieldValue, formatFieldValue } from '../schema.js'
import { propSource } from '../model.js'
import { Field, TextArea } from './Field.jsx'

function PropControl({ name, schema, value, authored, onChange }) {
  const kind = fieldKind(schema)
  const [error, setError] = useState(null)
  const commit = raw => {
    const parsed = parseFieldValue(kind, raw, schema)
    setError(parsed.error ?? null)
    if (!parsed.error) onChange(parsed.value)
  }
  const errors = value === undefined ? [] : propertyErrors(value, schema, name)
  const shown = error ?? errors[0]?.replace(`${name} `, '') ?? null
  let control
  if (kind === 'select') control = <select value={value ?? ''} onChange={e => commit(e.currentTarget.value)}>{schema.enum.map(option => <option key={option} value={option}>{String(option)}</option>)}</select>
  else if (kind === 'checkbox') control = <label class="row" style={{ textTransform: 'none', letterSpacing: 0, color: '#e0e0e0', fontSize: '13px' }}><input type="checkbox" checked={Boolean(value)} onChange={e => commit(e.currentTarget.checked)} style={{ flex: '0 0 auto' }} /> <span>{value ? 'on' : 'off'}</span></label>
  else if (kind === 'number') control = <input type="number" value={value ?? ''} min={schema.minimum} max={schema.maximum} step={schema.type === 'integer' ? 1 : 'any'} onInput={e => commit(e.currentTarget.value)} />
  else if (kind === 'yaml') control = <TextArea rows={2} value={formatFieldValue(kind, value)} onInput={commit} />
  else control = <input type="text" value={value ?? ''} onInput={e => commit(e.currentTarget.value)} />
  return <Field label={schema.title ?? name} required={schema.required} hint={schema.description} error={shown}>
    <div class="row">{control}{authored && <button class="btn is-small" title="Back to the default" onClick={() => onChange(undefined)}>×</button>}</div>
  </Field>
}

export function PropsForm({ slide, manifest, slideEdit }) {
  const properties = manifest?.properties ?? {}
  if (!Object.keys(properties).length) return null
  const values = resolveTemplateProps(manifest, slide.meta)
  const write = (key, value) => slideEdit((deck, id, current) => {
    if (propSource(current.authoredMeta, key) === 'legacy') return setSlideMeta(deck, id, { [key]: value })
    const props = { ...(current.authoredMeta.props ?? {}) }
    if (value === undefined) delete props[key]
    else props[key] = value
    return setSlideMeta(deck, id, { props: Object.keys(props).length ? props : undefined })
  }, { group: `prop:${key}` })
  return <>
    <p class="section-title">Settings</p>
    {Object.entries(properties).map(([name, schema]) => <PropControl key={name} name={name} schema={schema} value={values[name]} authored={Boolean(propSource(slide.authoredMeta, name))} onChange={value => write(name, value)} />)}
  </>
}
