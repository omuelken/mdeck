import { h, Fragment } from 'preact'
import { Icon } from '../../components/Icon.jsx'
import { CORE_TOKENS } from '../extensions.js'
import { Field, TextArea } from './Field.jsx'
import { PalettePicker, Swatches } from './PalettePicker.jsx'

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

export function TokenList({ tokens, onChange, suggestions = CORE_TOKENS, title = 'Tokens' }) {
  const missing = suggestions.filter(name => !tokens.some(token => token.name === name))
  return <>
    <p class="section-title">{title}</p>
    {tokens.map((token, index) => <div class="field" key={index}>
      <div class="row">
        <input type="text" value={token.name} placeholder="--name" style={{ flex: '0 0 140px', fontFamily: 'ui-monospace, monospace' }} onInput={e => onChange(update(tokens, index, { name: e.currentTarget.value }))} />
        {isColor(token.value) && <input type="color" value={token.value.length === 4 ? '#' + [...token.value.slice(1)].map(c => c + c).join('') : token.value.slice(0, 7)} style={{ flex: '0 0 auto' }} onInput={e => onChange(update(tokens, index, { value: e.currentTarget.value }))} />}
        <input type="text" value={token.value ?? ''} style={{ fontFamily: 'ui-monospace, monospace' }} onInput={e => onChange(update(tokens, index, { value: e.currentTarget.value }))} />
        <button class="btn is-small is-icon" title="Remove token" aria-label="Remove token" onClick={() => onChange(without(tokens, index))}><Icon name="close" size={14} /></button>
      </div>
    </div>)}
    <div class="row" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {missing.map(name => <button key={name} class="btn is-small" onClick={() => onChange([...tokens, { name, value: '#888888' }])}>+ {name}</button>)}
      <button class="btn is-small" onClick={() => onChange([...tokens, { name: '', value: '' }])}>+ other</button>
    </div>
  </>
}

// A palette has every colour twice: light (for bright rooms) and dark. Themes
// use the other variant for inverted slides.
export function PaletteForm({ model, onChange }) {
  return <>
    <Identity model={model} onChange={onChange} />
    <Field label="Only for the theme" hint="leave empty to offer it to every theme"><input type="text" value={model.theme ?? ''} placeholder="theme id" onInput={e => onChange({ theme: e.currentTarget.value.trim() })} /></Field>
    <TokenList title="Light colours" tokens={model.light} onChange={light => onChange({ light })} />
    <TokenList title="Dark colours" tokens={model.dark} onChange={dark => onChange({ dark })} />
  </>
}

// Theme tokens in groups, so fonts, sizes and spacing are found where one
// looks for them. Each group suggests the tokens themes usually set.
const TOKEN_GROUPS = [
  ['Fonts', name => name.startsWith('--font-'), ['--font-display', '--font-body', '--font-mono']],
  ['Sizes', name => name.startsWith('--fs-'), ['--fs-display', '--fs-title', '--fs-h', '--fs-body', '--fs-small']],
  ['Spacing', name => name.startsWith('--pad-'), ['--pad-x', '--pad-y']],
]
const groupOf = name => TOKEN_GROUPS.findIndex(([, test]) => test(name))

function TokenRow({ token, onChange, onRemove }) {
  return <div class="field">
    <div class="row">
      <input type="text" value={token.name} placeholder="--name" style={{ flex: '0 0 140px', fontFamily: 'ui-monospace, monospace' }} onInput={e => onChange({ name: e.currentTarget.value })} />
      {isColor(token.value) && <input type="color" value={token.value.length === 4 ? '#' + [...token.value.slice(1)].map(c => c + c).join('') : token.value.slice(0, 7)} style={{ flex: '0 0 auto' }} onInput={e => onChange({ value: e.currentTarget.value })} />}
      <input type="text" value={token.value ?? ''} style={{ fontFamily: 'ui-monospace, monospace' }} onInput={e => onChange({ value: e.currentTarget.value })} />
      <button class="btn is-small is-icon" title="Remove token" aria-label="Remove token" onClick={onRemove}><Icon name="close" size={14} /></button>
    </div>
  </div>
}

function ThemeTokens({ tokens, onChange, children }) {
  const set = (index, patch) => onChange(update(tokens, index, patch))
  const rows = test => tokens.map((token, index) => [token, index]).filter(([token]) => test(token))
    .map(([token, index]) => <TokenRow key={index} token={token} onChange={patch => set(index, patch)} onRemove={() => onChange(without(tokens, index))} />)
  const add = name => onChange([...tokens, { name, value: '' }])
  return <>
    {TOKEN_GROUPS.map(([title, , suggested], group) => <Fragment key={title}>
      <p class="section-title">{title}</p>
      {group === 0 && children}
      {rows(token => groupOf(token.name) === group)}
      <div class="row" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {suggested.filter(name => !tokens.some(token => token.name === name)).map(name => <button key={name} class="btn is-small" onClick={() => add(name)}>+ {name}</button>)}
      </div>
    </Fragment>)}
    <p class="section-title">Other tokens</p>
    {rows(token => groupOf(token.name) < 0)}
    <div><button class="btn is-small" onClick={() => add('')}>+ token</button></div>
  </>
}

export function ThemeForm({ model, files, palettes = {}, onChange, onFile }) {
  const tokenNames = model.tokens.map(token => token.name).filter(Boolean)
  // Palettes this theme may offer: shared ones and its own private ones.
  const usable = Object.values(palettes).filter(palette => !palette.theme || palette.theme === model.id)
  const offered = model.palettes?.length ? usable.filter(palette => model.palettes.includes(palette.id)) : usable
  const appearance = model.appearance ?? 'light'
  const toggle = (id, on) => onChange({ palettes: on ? [...(model.palettes ?? []), id] : (model.palettes ?? []).filter(other => other !== id) })
  return <>
    <Identity model={model} onChange={onChange} />
    <p class="section-title">Colours</p>
    <p class="hint-text">A theme takes all its colours from palettes; the deck can choose another one it offers.</p>
    <div class="grid-2">
      <Field label="Default palette">
        <PalettePicker offered={offered} selected={palettes[model.palette] ?? null} appearance={appearance} onChoose={id => onChange({ palette: id })} />
      </Field>
      <Field label="Starts"><select value={appearance} onChange={e => onChange({ appearance: e.currentTarget.value })}><option value="light">Light</option><option value="dark">Dark</option></select></Field>
    </div>
    <Field label="Offers these palettes" hint="none ticked offers every palette">
      <div class="palette-checks">
        {usable.map(palette => <label key={palette.id} class="palette-check">
          <input type="checkbox" checked={(model.palettes ?? []).includes(palette.id)} onChange={e => toggle(palette.id, e.currentTarget.checked)} />
          <span class="palette-name">{palette.title}</span><Swatches tokens={palette[appearance] ?? {}} />
        </label>)}
      </div>
    </Field>
    <ThemeTokens tokens={model.tokens} onChange={tokens => onChange({ tokens })}>
      <Field label="Font stylesheets" hint="one URL per line, e.g. from Google Fonts"><TextArea rows={2} value={model.fonts.join('\n')} onInput={text => onChange({ fonts: text.split(/\r?\n/).map(line => line.trim()).filter(Boolean) })} /></Field>
    </ThemeTokens>
    <p class="section-title">Author settings (params)</p>
    {model.params.map((param, index) => <div class="field" key={index}>
      <div class="row">
        <input type="text" value={param.name} placeholder="fontBody" onInput={e => onChange({ params: update(model.params, index, { name: e.currentTarget.value }) })} />
        <select value={param.token ?? ''} onChange={e => onChange({ params: update(model.params, index, { token: e.currentTarget.value }) })}><option value="">token…</option>{tokenNames.map(name => <option key={name} value={name}>{name}</option>)}</select>
        <input type="text" value={param.title ?? ''} placeholder="Title" onInput={e => onChange({ params: update(model.params, index, { title: e.currentTarget.value }) })} />
        <button class="btn is-small is-icon" title="Remove setting" aria-label="Remove setting" onClick={() => onChange({ params: without(model.params, index) })}><Icon name="close" size={14} /></button>
      </div>
    </div>)}
    <div><button class="btn is-small" onClick={() => onChange({ params: [...model.params, { name: '', token: tokenNames[0] ?? '', title: '' }] })}>+ setting</button></div>
    <details class="advanced">
      <summary>Advanced: styles.css</summary>
      <Field label="styles.css" hint="rules only; token defaults come from the lists above"><TextArea tall rows={20} value={files['styles.css'] ?? ''} onInput={text => onFile('styles.css', text)} /></Field>
    </details>
  </>
}
