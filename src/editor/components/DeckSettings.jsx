import { h } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { Icon } from '../../components/Icon.jsx'
import { setDeckConfig } from '../../core/editDeck.js'
import { resolvePalette } from '../../extensions/appearance.js'
import { palettesFor } from '../../extensions/tokens.js'
import { deckDiagnostics } from '../model.js'
import { Field } from './Field.jsx'
import { Diagnostics } from './Diagnostics.jsx'

// What the `show` setting controls: the label for each choice and its values.
const SHOW = { organization: ['Organization', ['title', 'all', 'none']], author: ['Author and date', ['title', 'all', 'none']], numbers: ['Slide numbers', ['slides', 'all', 'none']], sections: ['Section labels', ['all', 'none']] }
const META = [['title', 'Title'], ['author', 'Author'], ['organization', 'Organization'], ['date', 'Date'], ['logo', 'Logo path']]
const isColor = value => /^#[0-9a-f]{3,8}$/i.test(String(value ?? '').trim())

function Swatches({ tokens = {} }) {
  return <span class="swatches">{['--bg', '--surface', '--rule', '--accent', '--accent-2', '--ink'].map(key => tokens[key] ? <i key={key} style={{ background: tokens[key] }} /> : null)}</span>
}

// The palettes a theme offers, each with its colours in the light or dark
// the deck shows, so they can be compared before choosing.
function PalettePicker({ offered, selected, defaultId, appearance, onChoose }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = event => { if (event.type === 'keydown' ? event.key === 'Escape' : !ref.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close) }
  }, [open])
  const label = palette => <><span class="palette-name">{palette.title}{palette.id === defaultId && <span class="palette-default"> · theme default</span>}</span><Swatches tokens={palette[appearance] ?? {}} /></>
  return <div class="palette-picker" ref={ref}>
    <button type="button" class="palette-current" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(o => !o)}>
      {selected ? label(selected) : <span class="palette-name" />}
      <Icon name="dropdown" size={14} />
    </button>
    {open && <div class="palette-list" role="listbox" aria-label="Palette">
      {offered.map(palette => <button type="button" key={palette.id} role="option" aria-selected={palette.id === selected?.id} title={palette.description} class={palette.id === selected?.id ? 'is-active' : ''}
        onClick={() => { setOpen(false); onChoose(palette.id) }}>{label(palette)}</button>)}
    </div>}
  </div>
}

export function DeckSettings({ state, edit }) {
  const { deck, manifests, diagnostics, warnings } = state
  const config = deck.deckConfig
  const patch = (values, group) => edit(d => setDeckConfig(d, values), { group })
  const themeId = config.theme ?? 'neue'
  const theme = manifests.themes[themeId]
  // The palettes this theme offers and the one the deck gets (its own, else the theme's).
  // The theme's own palette comes first.
  const offered = (theme ? palettesFor(theme, manifests.palettes) : Object.values(manifests.palettes))
    .sort((a, b) => (b.id === theme?.palette) - (a.id === theme?.palette))
  const shown = theme ? resolvePalette({ theme, palettes: manifests.palettes, palette: config.palette, appearance: config.appearance }) : { palette: null, appearance: 'light' }
  const palette = shown.palette
  const text = (key, value) => patch({ [key]: value === '' ? undefined : value }, `deck:${key}`)
  const themeAppearance = theme?.appearance ?? 'light'
  // A palette the new theme does not offer is dropped, so the deck gets that theme's own.
  const chooseTheme = id => {
    const next = manifests.themes[id]
    const keeps = !config.palette || !next || palettesFor(next, manifests.palettes).some(p => p.id === config.palette)
    patch({ theme: id, ...(keeps ? {} : { palette: undefined }) }, 'deck:theme')
  }
  const meta = (key, value) => { const next = { ...(config.meta ?? {}) }; if (value === '') delete next[key]; else next[key] = value; patch({ meta: Object.keys(next).length ? next : undefined }, `deck:meta:${key}`) }
  const show = (key, value) => { const next = { ...(config.show ?? {}) }; if (value === '') delete next[key]; else next[key] = value; patch({ show: Object.keys(next).length ? next : undefined }, `deck:show:${key}`) }
  const param = (key, value) => { const next = { ...(config.params ?? {}) }; if (value === '') delete next[key]; else next[key] = value; patch({ params: Object.keys(next).length ? next : undefined }, `deck:params:${key}`) }
  const problems = deckDiagnostics(diagnostics, deck)
  return <div class="form">
    <Diagnostics items={[...warnings.map(message => ({ severity: 'warning', message, code: 'extension' })), ...problems]} />
    <p class="section-title">Look</p>
    <Field label="Theme" hint={theme?.description}>
      <select value={themeId} onChange={e => chooseTheme(e.currentTarget.value)}>
        {!theme && <option value={themeId}>{themeId}</option>}
        {Object.values(manifests.themes).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
      </select>
    </Field>
    <Field label="Palette" hint={palette?.description}>
      <PalettePicker offered={offered} selected={palette} defaultId={theme?.palette} appearance={shown.appearance}
        onChoose={id => text('palette', id === theme?.palette ? '' : id)} />
    </Field>
    <Field label="Light or dark" hint="dark for dark rooms; inverted slides use the other one">
      <div class="appearance-toggle" role="group" aria-label="Light or dark">
        {['light', 'dark'].map(mode => <button type="button" key={mode} class={`btn${shown.appearance === mode ? ' is-active' : ''}`} aria-pressed={shown.appearance === mode}
          onClick={() => text('appearance', mode === themeAppearance ? '' : mode)}>
          <Icon name={mode === 'light' ? 'sun' : 'moon'} size={14} />{mode === 'light' ? 'Light' : 'Dark'}{mode === themeAppearance && <span class="palette-default"> · theme default</span>}
        </button>)}
      </div>
    </Field>
    {theme && Object.keys(theme.params).length > 0 && <>
      <p class="section-title">Theme settings</p>
      {Object.entries(theme.params).map(([key, def]) => {
        const value = config.params?.[key]
        const color = isColor(def.default)
        return <Field key={key} label={def.title ?? key} hint={def.description}>
          <div class="row">
            {color ? <input type="color" value={isColor(value) ? value : def.default} onInput={e => param(key, e.currentTarget.value)} style={{ flex: '0 0 auto' }} /> : null}
            <input type="text" value={value ?? ''} placeholder={def.default} onInput={e => param(key, e.currentTarget.value)} />
            {value != null && <button class="btn is-small is-icon" title="Back to the default" aria-label="Back to the default" onClick={() => param(key, '')}><Icon name="close" size={14} /></button>}
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
      {Object.entries(SHOW).map(([key, [label, options]]) => <Field key={key} label={label}>
        <select value={config.show?.[key] ?? ''} onChange={e => show(key, e.currentTarget.value)}><option value="">default</option>{options.map(o => <option key={o} value={o}>{o}</option>)}</select>
      </Field>)}
      <Field label="Language" hint="of the deck, e.g. en, de or de-CH"><input type="text" value={config.lang ?? ''} placeholder="en" onInput={e => text('lang', e.currentTarget.value)} /></Field>
    </div>
  </div>
}
