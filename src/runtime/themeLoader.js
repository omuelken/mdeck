import baseCSS from '../../assets/base.css?inline'
import { themes, palettes } from 'virtual:mdeck-extensions'
import { buildAppearance } from '../extensions/appearance.js'
import { movedHint } from '../extensions/moved.js'

const SELF_CONTAINED = typeof __MDECK_SELF_CONTAINED__ !== 'undefined'
  && __MDECK_SELF_CONTAINED__

export const THEME_NAMES = Object.keys(themes)
export const THEME_METAS = Object.fromEntries(Object.entries(themes).map(([id, theme]) => [id, theme.manifest]))
export const PALETTES = Object.fromEntries(Object.entries(palettes).map(([id, palette]) => [id, palette.manifest]))

// The editor previews unsaved themes and palettes by handing their manifests
// (and, for themes, stylesheet text) to the runtime instead of the built
// module. Overrides win over registered extensions of the same id.
let overrides = { themes: {}, palettes: {} }
export function setExtensionOverrides(next = {}) {
  overrides = { themes: next.themes ?? {}, palettes: next.palettes ?? {} }
}
function themeEntry(id) {
  const override = overrides.themes[id]
  if (override) return { manifest: override.manifest ?? override, load: () => typeof override.styles === 'string' ? Promise.resolve(override.styles) : themes[id]?.load() ?? Promise.resolve('') }
  return themes[id]
}
// Every palette, with the editor's unsaved ones in place of the registered.
const allPalettes = () => ({ ...PALETTES, ...Object.fromEntries(Object.entries(overrides.palettes).map(([id, palette]) => [id, palette.manifest ?? palette])) })

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

export async function loadTheme({ theme = 'neue', palette, appearance, params = {}, meta = {} } = {}) {
  const entry = themeEntry(theme)
  if (!entry) throw new Error(movedHint('theme', theme) ?? `Unknown theme: "${theme}". Available: ${THEME_NAMES.join(', ')}`)

  const styles = await entry.load()
  const look = buildAppearance({
    theme: entry.manifest, palettes: allPalettes(), palette, appearance,
    params, meta, offline: SELF_CONTAINED,
  })
  for (const warning of look.warnings) console.warn(warning)

  // Token defaults come from the manifest; the stylesheet only holds rules.
  upsertStyle('deck-theme', [baseCSS, look.themeCss, styles].join('\n'))
  // Offline-ready builds deliberately use the declared system-font fallbacks.
  syncThemeFonts(look.fonts)
  // The palette's colours, between the theme's tokens and the deck's params.
  upsertStyle('deck-palette', look.paletteCss)
  upsertStyle('deck-overrides', look.overridesCss)
}
