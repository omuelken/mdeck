import { h } from 'preact'
import { CORE_TOKENS, PROPERTY_TYPES, FRAMES } from '../extensions.js'
import { Field, TextArea } from './Field.jsx'

const isColor = value => /^#[0-9a-f]{3,8}$/i.test(String(value ?? '').trim())
const update = (list, index, patch) => list.map((item, i) => i === index ? { ...item, ...patch } : item)
const without = (list, index) => list.filter((_, i) => i !== index)

function Identity({ model, onChange }) {
  return <>
    <div class="grid-2">
      <Field label="Title"><input type="text" value={model.title} onInput={e => onChange({ title: e.currentTarget.value })} /></Field>
      <Field label="Id" hint="folder name"><input type="text" value={model.id} disabled /></Field>
    </div>
    <Field label="Description"><input type="text" value={model.description ?? ''} onInput={e => onChange({ description: e.currentTarget.value })} /></Field>
  </>
}

export function TokenList({ tokens, onChange, suggestions = CORE_TOKENS }) {
  const missing = suggestions.filter(name => !tokens.some(token => token.name === name))
  return <>
    <p class="section-title">Tokens</p>
    {tokens.map((token, index) => <div class="field" key={index}>
      <div class="row">
        <input type="text" value={token.name} placeholder="--name" style={{ flex: '0 0 140px', fontFamily: 'ui-monospace, monospace' }} onInput={e => onChange(update(tokens, index, { name: e.currentTarget.value }))} />
        {isColor(token.value) && <input type="color" value={token.value.length === 4 ? '#' + [...token.value.slice(1)].map(c => c + c).join('') : token.value.slice(0, 7)} style={{ flex: '0 0 auto' }} onInput={e => onChange(update(tokens, index, { value: e.currentTarget.value }))} />}
        <input type="text" value={token.value ?? ''} style={{ fontFamily: 'ui-monospace, monospace' }} onInput={e => onChange(update(tokens, index, { value: e.currentTarget.value }))} />
        <button class="btn is-small" title="Remove token" onClick={() => onChange(without(tokens, index))}>×</button>
      </div>
    </div>)}
    <div class="row" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {missing.map(name => <button key={name} class="btn is-small" onClick={() => onChange([...tokens, { name, value: '#888888' }])}>+ {name}</button>)}
      <button class="btn is-small" onClick={() => onChange([...tokens, { name: '', value: '' }])}>+ other</button>
    </div>
  </>
}

export function PaletteForm({ model, onChange }) {
  return <>
    <Identity model={model} onChange={onChange} />
    <Field><label class="row" style={{ textTransform: 'none', letterSpacing: 0, color: '#e0e0e0', fontSize: '13px' }}><input type="checkbox" checked={model.dark} style={{ flex: '0 0 auto' }} onChange={e => onChange({ dark: e.currentTarget.checked })} /> <span>Dark palette (inverts logos and code colors)</span></label></Field>
    <TokenList tokens={model.tokens} onChange={tokens => onChange({ tokens })} />
  </>
}

export function ThemeForm({ model, files, onChange, onFile }) {
  const tokenNames = model.tokens.map(token => token.name).filter(Boolean)
  return <>
    <Identity model={model} onChange={onChange} />
    <div class="grid-2">
      <Field><label class="row" style={{ textTransform: 'none', letterSpacing: 0, color: '#e0e0e0', fontSize: '13px' }}><input type="checkbox" checked={model.dark} style={{ flex: '0 0 auto' }} onChange={e => onChange({ dark: e.currentTarget.checked })} /> <span>Dark by default</span></label></Field>
      <Field><label class="row" style={{ textTransform: 'none', letterSpacing: 0, color: '#e0e0e0', fontSize: '13px' }}><input type="checkbox" checked={model.accent2} style={{ flex: '0 0 auto' }} onChange={e => onChange({ accent2: e.currentTarget.checked })} /> <span>Uses a second accent</span></label></Field>
    </div>
    {model.accent2 && <Field label="Accent 2 preview color" hint="only needed when --accent-2 is not a plain color"><input type="text" value={model.accent2Preview} onInput={e => onChange({ accent2Preview: e.currentTarget.value })} /></Field>}
    <Field label="Font stylesheets" hint="one URL per line"><TextArea rows={2} value={model.fonts.join('\n')} onInput={text => onChange({ fonts: text.split(/\r?\n/).map(line => line.trim()).filter(Boolean) })} /></Field>
    <TokenList tokens={model.tokens} onChange={tokens => onChange({ tokens })} suggestions={[...CORE_TOKENS, '--font-display', '--font-body', '--fs-display', '--fs-title', '--fs-h', '--fs-body', '--fs-small', '--pad-x', '--pad-y']} />
    <p class="section-title">Author settings (params)</p>
    {model.params.map((param, index) => <div class="field" key={index}>
      <div class="row">
        <input type="text" value={param.name} placeholder="primaryColor" onInput={e => onChange({ params: update(model.params, index, { name: e.currentTarget.value }) })} />
        <select value={param.token ?? ''} onChange={e => onChange({ params: update(model.params, index, { token: e.currentTarget.value }) })}><option value="">token…</option>{tokenNames.map(name => <option key={name} value={name}>{name}</option>)}</select>
        <input type="text" value={param.title ?? ''} placeholder="Title" onInput={e => onChange({ params: update(model.params, index, { title: e.currentTarget.value }) })} />
        <button class="btn is-small" onClick={() => onChange({ params: without(model.params, index) })}>×</button>
      </div>
    </div>)}
    <div><button class="btn is-small" onClick={() => onChange({ params: [...model.params, { name: '', token: tokenNames[0] ?? '', title: '' }] })}>+ setting</button></div>
    <Field label="styles.css" hint="rules only; token defaults come from the list above"><TextArea tall rows={20} value={files['styles.css'] ?? ''} onInput={text => onFile('styles.css', text)} /></Field>
  </>
}

function PropertyRow({ property, onChange, onRemove }) {
  const set = patch => onChange({ ...property, ...patch })
  const numeric = ['number', 'integer'].includes(property.type)
  return <div class="field" style={{ padding: '10px', border: '1px solid #262626', borderRadius: '6px', gap: '8px' }}>
    <div class="row">
      <input type="text" value={property.name} placeholder="name" style={{ fontFamily: 'ui-monospace, monospace' }} onInput={e => set({ name: e.currentTarget.value })} />
      <select value={property.type ?? 'string'} onChange={e => set({ type: e.currentTarget.value, items: e.currentTarget.value === 'array' ? property.items ?? { type: 'string' } : null })}>{PROPERTY_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select>
      <button class="btn is-small" onClick={onRemove}>×</button>
    </div>
    <div class="row">
      <input type="text" value={property.title ?? ''} placeholder="Title" onInput={e => set({ title: e.currentTarget.value })} />
      <input type="text" value={property.description ?? ''} placeholder="Description" onInput={e => set({ description: e.currentTarget.value })} />
    </div>
    <div class="row">
      <input type="text" value={(property.enum ?? []).join(', ')} placeholder="choices, comma separated" onInput={e => set({ enum: e.currentTarget.value.split(',').map(v => v.trim()).filter(Boolean) })} />
      <input type="text" value={property.default === undefined || property.default === null ? '' : typeof property.default === 'string' ? property.default : JSON.stringify(property.default)} placeholder="default (JSON for lists)" onInput={e => { const raw = e.currentTarget.value; let value = raw; if (raw === '') value = undefined; else if (property.type !== 'string') { try { value = JSON.parse(raw) } catch { value = raw } } set({ default: value }) }} />
      <label class="row" style={{ flex: '0 0 auto', color: '#d0d0d0' }}><input type="checkbox" checked={Boolean(property.required)} onChange={e => set({ required: e.currentTarget.checked })} /> required</label>
    </div>
    {(numeric || property.type === 'array') && <div class="row">
      {numeric && <input type="number" value={property.minimum ?? ''} placeholder="min" onInput={e => set({ minimum: e.currentTarget.value === '' ? undefined : Number(e.currentTarget.value) })} />}
      {numeric && <input type="number" value={property.maximum ?? ''} placeholder="max" onInput={e => set({ maximum: e.currentTarget.value === '' ? undefined : Number(e.currentTarget.value) })} />}
      {property.type === 'array' && <input type="number" value={property.minItems ?? ''} placeholder="min items" onInput={e => set({ minItems: e.currentTarget.value === '' ? undefined : Number(e.currentTarget.value) })} />}
      {property.type === 'array' && <input type="number" value={property.maxItems ?? ''} placeholder="max items" onInput={e => set({ maxItems: e.currentTarget.value === '' ? undefined : Number(e.currentTarget.value) })} />}
      {property.type === 'array' && <select value={property.items?.type ?? 'string'} onChange={e => set({ items: { ...(property.items ?? {}), type: e.currentTarget.value } })}>{PROPERTY_TYPES.filter(t => !['array', 'object'].includes(t)).map(type => <option key={type} value={type}>items: {type}</option>)}</select>}
    </div>}
  </div>
}

export function TemplateForm({ model, files, onChange, onFile }) {
  return <>
    <Identity model={model} onChange={onChange} />
    <Field label="Frame" hint="header and footer style"><select value={model.frame} onChange={e => onChange({ frame: e.currentTarget.value })}>{FRAMES.map(frame => <option key={frame} value={frame}>{frame}</option>)}</select></Field>
    <p class="section-title">Content areas (regions)</p>
    {model.regions.map((region, index) => <div class="field" key={index}>
      <div class="row">
        <input type="text" value={region.name} placeholder="name" disabled={region.name === 'body'} style={{ flex: '0 0 120px', fontFamily: 'ui-monospace, monospace' }} onInput={e => onChange({ regions: update(model.regions, index, { name: e.currentTarget.value }) })} />
        <input type="text" value={region.description ?? ''} placeholder="What goes here" onInput={e => onChange({ regions: update(model.regions, index, { description: e.currentTarget.value }) })} />
        <label class="row" style={{ flex: '0 0 auto', color: '#d0d0d0' }}><input type="checkbox" checked={Boolean(region.required)} onChange={e => onChange({ regions: update(model.regions, index, { required: e.currentTarget.checked }) })} /> required</label>
        {region.name !== 'body' && <button class="btn is-small" onClick={() => onChange({ regions: without(model.regions, index) })}>×</button>}
      </div>
    </div>)}
    <div><button class="btn is-small" onClick={() => onChange({ regions: [...model.regions, { name: '', description: '', required: false }] })}>+ area</button></div>
    <p class="section-title">Settings (properties)</p>
    {model.properties.map((property, index) => <PropertyRow key={index} property={property} onChange={next => onChange({ properties: update(model.properties, index, next) })} onRemove={() => onChange({ properties: without(model.properties, index) })} />)}
    <div><button class="btn is-small" onClick={() => onChange({ properties: [...model.properties, { name: '', type: 'string', enum: [], items: null }] })}>+ setting</button></div>
    <Field label="layout.jsx" hint="Preact component; reloads the preview when saved"><TextArea tall rows={18} value={files['layout.jsx'] ?? ''} onInput={text => onFile('layout.jsx', text)} /></Field>
    <Field label="styles.css"><TextArea rows={8} value={files['styles.css'] ?? ''} onInput={text => onFile('styles.css', text)} /></Field>
    <Field label="starter.md" hint="what a new slide of this kind starts with"><TextArea rows={8} value={files['starter.md'] ?? ''} onInput={text => onFile('starter.md', text)} /></Field>
  </>
}
