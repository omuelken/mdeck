// Browser-safe helpers shared by the runtime, the CLI and tests.

export const TOKEN_NAME_RE = /^--[a-z][a-z0-9-]*$/

export function tokensToCss(tokens = {}, selector = ':root') {
  const entries = Object.entries(tokens)
  if (!entries.length) return ''
  return `${selector} {\n  ${entries.map(([name, value]) => `${name}: ${value};`).join('\n  ')}\n}`
}

// The colours every palette variant defines. Themes use only these (and
// mixes of them), so any palette fits any theme. The three accents mean
// something: --accent is emphasis (and notes, tips, important callouts),
// --accent-2 its companion (gradients, a contrast to the accent), --accent-3
// attention (warnings and cautions), used sparingly; it marks things and
// need not be readable as text.
export const COLOR_ROLES = ['--bg', '--surface', '--ink', '--ink-soft', '--muted', '--rule', '--accent', '--accent-2', '--accent-3', '--on-accent']
// Colours a palette may leave out, and what it gets instead: palettes made
// before the third accent get an amber that calls for attention in light and
// dark alike (`mdeck check` suggests setting one's own).
export const COLOR_FALLBACKS = { '--accent-3': { light: '#d99a00', dark: '#f5c542' } }
export const APPEARANCES = ['light', 'dark']

/**
 * The palettes a theme offers, as manifests: the ones it lists in `palettes`,
 * else every palette that is not private to another theme. A private palette
 * (`theme = "…"`) is only offered to its own theme.
 */
export function palettesFor(theme, palettes = {}) {
  const all = Object.values(palettes)
  if (theme?.palettes) return theme.palettes.map(id => palettes[id]).filter(Boolean)
  return all.filter(palette => !palette.theme || palette.theme === theme?.id)
}
