import baseCSS from '../../assets/base.css?inline'
import { themes, palettes } from 'virtual:mdeck-extensions'
import { buildAppearance } from '../extensions/appearance.js'

const SELF_CONTAINED = typeof __MDECK_SELF_CONTAINED__ !== 'undefined'
  && __MDECK_SELF_CONTAINED__

export const THEME_NAMES = Object.keys(themes)
export const PALETTE_NAMES = Object.keys(palettes)
export const THEME_METAS = Object.fromEntries(Object.entries(themes).map(([id, theme]) => [id, theme.manifest]))
export const PALETTES = Object.fromEntries(Object.entries(palettes).map(([id, palette]) => [id, palette.manifest]))

function upsertStyle(id, textContent) {
  let el = document.getElementById(id)
  if (!el) {
    el = document.createElement('style')
    el.id = id
    document.head.appendChild(el)
  }
  el.textContent = textContent
}

function syncThemeFonts(urls) {
  for (const existing of [...document.querySelectorAll('link[data-deck-theme-font]')]) {
    existing.remove()
  }
  for (const fontUrl of urls ?? []) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = fontUrl
    link.setAttribute('data-deck-theme-font', '1')
    document.head.appendChild(link)
  }
}

export async function loadTheme({ design = 'neue', palette, accent, accent2, params = {}, meta = {} } = {}) {
  const theme = themes[design]
  if (!theme) throw new Error(`Unknown theme: "${design}". Available: ${THEME_NAMES.join(', ')}`)

  const styles = await theme.load()
  const appearance = buildAppearance({
    theme: theme.manifest, palette: PALETTES[palette] ?? null, paletteId: palette ?? '',
    params, accent, accent2, meta, offline: SELF_CONTAINED,
  })
  for (const warning of appearance.warnings) console.warn(warning)

  // Token defaults come from the manifest; the stylesheet only holds rules.
  upsertStyle('deck-theme', [baseCSS, appearance.themeCss, styles].join('\n'))
  // Offline-ready builds deliberately use the declared system-font fallbacks.
  syncThemeFonts(appearance.fonts)
  // Palette sits between theme tokens and per-deck params.
  upsertStyle('deck-palette', appearance.paletteCss)
  upsertStyle('deck-overrides', appearance.overridesCss)
}
