import { h } from 'preact'
import { setDeckConfig } from '../../core/editDeck.js'
import { effectiveToken } from '../../extensions/appearance.js'
import { deckDiagnostics } from '../model.js'
import { Field } from './Field.jsx'
import { Diagnostics } from './Diagnostics.jsx'

const ENUMS = { institution: ['title', 'all', 'none'], authorDate: ['title', 'all', 'none'], pageNumbers: ['slides', 'all', 'none'], sections: ['all', 'none'] }
const META = [['title', 'Title'], ['author', 'Author'], ['organization', 'Organization'], ['date', 'Date'], ['logo', 'Logo path']]
const isColor = value => /^#[0-9a-f]{3,8}$/i.test(String(value ?? '').trim())

function Swatches({ tokens = {} }) {
  return <span class="swatches">{['--bg', '--surface', '--rule', '--accent', '--accent-2', '--ink'].map(key => tokens[key] ? <i key={key} style={{ background: tokens[key] }} /> : null)}</span>
}

export function DeckSettings({ state, edit }) {
  const { deck, manifests, diagnostics, warnings } = state
  const config = deck.deckConfig
  const patch = (values, group) => edit(d => setDeckConfig(d, values), { group })
  const design = config.design ?? 'neue'
  const theme = manifests.themes[design]
  const palette = config.palette ? manifests.palettes[config.palette] : null
  const appearance = { theme, palette, params: config.params, accent: config.accent, accent2: config.accent2 }
  const text = (key, value) => patch({ [key]: value === '' ? undefined : value }, `deck:${key}`)
  const meta = (key, value) => { const next = { ...(config.meta ?? {}) }; if (value === '') delete next[key]; else next[key] = value; patch({ meta: Object.keys(next).length ? next : undefined }, `deck:meta:${key}`) }
  const param = (key, value) => { const next = { ...(config.params ?? {}) }; if (value === '') delete next[key]; else next[key] = value; patch({ params: Object.keys(next).length ? next : undefined }, `deck:params:${key}`) }
  const problems = deckDiagnostics(diagnostics, deck)
  return <div class="form">
    <Diagnostics items={[...warnings.map(message => ({ severity: 'warning', message, code: 'extension' })), ...problems]} />
    <p class="section-title">Look</p>
    <Field label="Theme" hint={theme?.description}>
      <select value={design} onChange={e => text('design', e.currentTarget.value)}>
        {!theme && <option value={design}>{design}</option>}
        {Object.values(manifests.themes).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
      </select>
    </Field>
    <Field label="Palette" hint={palette?.description}>
      <div class="row">
        <select value={config.palette ?? ''} onChange={e => text('palette', e.currentTarget.value)}>
          <option value="">Theme colors</option>
          {config.palette && !palette && <option value={config.palette}>{config.palette}</option>}
          {Object.values(manifests.palettes).map(p => <option key={p.id} value={p.id}>{p.title}{p.dark ? ' (dark)' : ''}</option>)}
        </select>
        {palette && <Swatches tokens={palette.tokens} />}
      </div>
    </Field>
    <div class="grid-2">
      <Field label="Accent">
        <div class="row"><input type="color" value={effectiveToken('--accent', appearance) ?? '#888888'} onInput={e => text('accent', e.currentTarget.value)} style={{ flex: '0 0 auto' }} /><span style={{ color: '#666' }}>{config.accent ?? 'from theme'}</span>{config.accent && <button class="btn is-small" onClick={() => text('accent', '')}>×</button>}</div>
      </Field>
      {theme?.accent2 && <Field label="Accent 2">
        <div class="row"><input type="color" value={effectiveToken('--accent-2', appearance) ?? '#888888'} onInput={e => text('accent2', e.currentTarget.value)} style={{ flex: '0 0 auto' }} /><span style={{ color: '#666' }}>{config.accent2 ?? 'from theme'}</span>{config.accent2 && <button class="btn is-small" onClick={() => text('accent2', '')}>×</button>}</div>
      </Field>}
    </div>
    {theme && Object.keys(theme.params).length > 0 && <>
      <p class="section-title">Theme settings</p>
      {Object.entries(theme.params).map(([key, def]) => {
        const value = config.params?.[key]
        const color = isColor(def.default)
        return <Field key={key} label={def.title ?? key} hint={def.description}>
          <div class="row">
            {color ? <input type="color" value={isColor(value) ? value : def.default} onInput={e => param(key, e.currentTarget.value)} style={{ flex: '0 0 auto' }} /> : null}
            <input type="text" value={value ?? ''} placeholder={def.default} onInput={e => param(key, e.currentTarget.value)} />
            {value != null && <button class="btn is-small" onClick={() => param(key, '')}>×</button>}
          </div>
        </Field>
      })}
    </>}
    <p class="section-title">About the talk</p>
    {META.map(([key, label]) => <Field key={key} label={label}><input type="text" value={config.meta?.[key] ?? ''} onInput={e => meta(key, e.currentTarget.value)} /></Field>)}
    <p class="section-title">Slide frame</p>
    <div class="grid-2">
      <Field label="Width"><input type="number" value={config.width ?? 1920} onInput={e => patch({ width: Number(e.currentTarget.value) || undefined }, 'deck:width')} /></Field>
      <Field label="Height"><input type="number" value={config.height ?? 1080} onInput={e => patch({ height: Number(e.currentTarget.value) || undefined }, 'deck:height')} /></Field>
      {Object.entries(ENUMS).map(([key, options]) => <Field key={key} label={key}>
        <select value={config[key] ?? ''} onChange={e => text(key, e.currentTarget.value)}><option value="">default</option>{options.map(o => <option key={o} value={o}>{o}</option>)}</select>
      </Field>)}
      <Field label="Language" hint="for callout labels"><input type="text" value={config.lang ?? ''} placeholder="en" onInput={e => text('lang', e.currentTarget.value)} /></Field>
    </div>
  </div>
}
