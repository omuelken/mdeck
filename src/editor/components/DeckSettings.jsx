import { h } from 'preact'
import { Icon } from '../../components/Icon.jsx'
import { setDeckConfig } from '../../core/editDeck.js'
import { resolvePalette } from '../../extensions/appearance.js'
import { palettesFor } from '../../extensions/tokens.js'
import { deckDiagnostics } from '../model.js'
import { Field } from './Field.jsx'
import { Diagnostics } from './Diagnostics.jsx'
import { PalettePicker } from './PalettePicker.jsx'
import { LookThumbnail } from './LookThumbnail.jsx'
import { designUrl, DESIGN_TAB } from '../designLink.js'

// What the `show` setting controls: the label for each choice and its values.
const SHOW = { organization: ['Organization', ['title', 'all', 'none']], author: ['Author and date', ['title', 'all', 'none']], numbers: ['Slide numbers', ['slides', 'all', 'none']], sections: ['Section labels', ['all', 'none']] }
const META = [['title', 'Title'], ['author', 'Author'], ['organization', 'Organization'], ['date', 'Date'], ['logo', 'Logo path']]
const isColor = value => /^#[0-9a-f]{3,8}$/i.test(String(value ?? '').trim())

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
  const offers = (next, paletteId) => !paletteId || !next || palettesFor(next, manifests.palettes).some(p => p.id === paletteId)
  const chooseTheme = id => {
    const keeps = offers(manifests.themes[id], config.palette)
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
      <div class="theme-grid" role="radiogroup" aria-label="Theme">
        {!theme && <button type="button" role="radio" aria-checked="true" class="theme-choice is-active"><span class="theme-choice-name">{themeId} (not found)</span></button>}
        {Object.values(manifests.themes).map(t => <button type="button" key={t.id} role="radio" aria-checked={t.id === themeId} title={t.description}
          class={`theme-choice${t.id === themeId ? ' is-active' : ''}`} onClick={() => chooseTheme(t.id)}>
          <LookThumbnail theme={t.id} palette={offers(t, config.palette) ? config.palette ?? '' : ''} />
          <span class="theme-choice-name">{t.title}{t.source === 'local' && <span class="palette-default"> · this deck</span>}</span>
        </button>)}
      </div>
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
    <Field label="Make it your own" hint="opens the design page; a built-in one is copied into this deck's extensions folder first">
      <div class="row" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {theme && <DesignLink kind="theme" item={theme} />}
        {palette && <DesignLink kind="palette" item={palette} />}
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

// Opens the design page on the deck's own theme or palette, or on a new copy
// of a built-in one.
function DesignLink({ kind, item }) {
  const own = item.source === 'local'
  return <a class="btn is-small" target={DESIGN_TAB} href={designUrl(own ? { open: `${kind}:${item.id}` } : { copy: `${kind}:${item.id}` })}>
    {own ? `Edit ${kind}` : `Customise ${kind}`} <span class="muted">{item.title}</span>
  </a>
}
