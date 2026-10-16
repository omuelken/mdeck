// Pure appearance resolution shared by the runtime and tests.
//
// Colours come from exactly one place, the palette: the deck's `palette`, or
// the theme's default. A palette has a light and a dark variant; the deck's
// `appearance` (else the theme's) picks the one for the slides, and the other
// one is available to inverted slides as --inverse-bg, --inverse-ink, …
// Theme tokens (type, spacing, fonts) and theme parameters come on top.
import { tokensToCss, COLOR_ROLES, APPEARANCES, palettesFor } from './tokens.js'
import { movedHint } from './moved.js'
import { paramValue } from './params.js'

// Code highlighting and logos on dark slides, unless the palette says otherwise.
export const DARK_TOKENS = {
  '--logo-filter':    'invert(1)',
  '--token-default':  '#e2e8f0',
  '--token-comment':  '#718096',
  '--token-string':   '#68d391',
  '--token-number':   '#fc8181',
  '--token-keyword':  '#90cdf4',
  '--token-function': '#d6bcfa',
  '--token-operator': '#fbd38d',
  // The drawing pen's red, blue and green, lighter for dark slides.
  '--pen-red':        '#fb7185',
  '--pen-blue':       '#60a5fa',
  '--pen-green':      '#4ade80',
  // The highlighter brightens the text under it: screen on dark slides.
  '--highlighter-blend': 'screen',
}

// The same on light slides: the code colours of code-block.css and the logo
// as it is. A theme's inverted slide (neue's focus) takes the other set as
// --inverse-token-* and --inverse-logo-filter.
export const LIGHT_TOKENS = {
  '--logo-filter':    'none',
  '--highlighter-blend': 'multiply',
  '--token-default':  '#0a0a0a',
  '--token-comment':  '#708090',
  '--token-string':   '#669900',
  '--token-number':   '#905050',
  '--token-keyword':  '#0077aa',
  '--token-function': '#dd4a68',
  '--token-operator': '#9a6e3a',
}

const other = appearance => appearance === 'dark' ? 'light' : 'dark'

/**
 * Which palette and variant a deck gets: `{ palette, appearance, warnings }`.
 * An unknown palette, or one the theme does not offer, falls back to the
 * theme's default with a warning (mdeck check reports these as errors).
 */
export function resolvePalette({ theme, palettes = {}, palette: requested, appearance: requestedAppearance } = {}) {
  const warnings = []
  const offered = palettesFor(theme, palettes)
  let palette = requested ? palettes[requested] : null
  if (requested && !palette) warnings.push(movedHint('palette', requested) ?? `Unknown palette "${requested}". Available: ${offered.map(p => p.id).join(', ')}`)
  else if (palette && !offered.includes(palette)) { warnings.push(`The theme "${theme.id}" does not offer the palette "${requested}". Available: ${offered.map(p => p.id).join(', ')}`); palette = null }
  palette ??= palettes[theme.palette] ?? offered[0] ?? null
  let appearance = requestedAppearance || theme.appearance || 'light'
  if (!APPEARANCES.includes(appearance)) { warnings.push(`appearance must be one of: ${APPEARANCES.join(', ')}`); appearance = theme.appearance ?? 'light' }
  return { palette, appearance, warnings }
}

/** The CSS custom properties of a palette in one appearance, with the other one as --inverse-*. */
export function paletteTokens(palette, appearance = 'light') {
  if (!palette) return {}
  const main = palette[appearance], inverse = palette[other(appearance)]
  const tokens = { ...(appearance === 'dark' ? DARK_TOKENS : {}), ...main }
  for (const role of COLOR_ROLES) tokens[`--inverse-${role.slice(2)}`] = inverse[role]
  for (const name of Object.keys(LIGHT_TOKENS)) tokens[`--inverse-${name.slice(2)}`] = (appearance === 'dark' ? LIGHT_TOKENS : DARK_TOKENS)[name]
  return tokens
}

export function buildAppearance({ theme, palettes = {}, palette, appearance, params = {}, meta = {}, offline = false } = {}) {
  if (!theme) throw new Error('A theme manifest is required')
  const resolved = resolvePalette({ theme, palettes, palette, appearance })
  const warnings = [...resolved.warnings]
  const themeCss = tokensToCss(theme.tokens)
  const paletteCss = tokensToCss({ 'color-scheme': resolved.appearance, ...paletteTokens(resolved.palette, resolved.appearance) })

  const overrides = {}
  for (const [name, value] of Object.entries(params ?? {})) {
    const param = theme.params?.[name]
    if (!param) { warnings.push(`Theme "${theme.id}" has no parameter "${name}"`); continue }
    // A value that does not fit the parameter's type is left out: the theme's own value stays.
    const result = paramValue(param, value)
    if (result.problem) warnings.push(`params.${name} ${result.problem}; the theme's ${param.default} is used`)
    else overrides[param.token] = result.value
  }
  for (const [key, value] of Object.entries(meta ?? {})) overrides[`--meta-${key}`] = JSON.stringify(String(value))
  const overridesCss = tokensToCss(overrides)

  // Offline-ready builds deliberately use the declared system-font fallbacks.
  const fonts = offline ? [] : theme.fonts ?? []
  return { themeCss, paletteCss, overridesCss, fonts, warnings, palette: resolved.palette?.id ?? null, appearance: resolved.appearance }
}

/** A colour of the palette a deck gets, for previews and swatches. */
export function paletteColor(token, { theme, palettes = {}, palette, appearance } = {}) {
  const resolved = resolvePalette({ theme, palettes, palette, appearance })
  return resolved.palette?.[resolved.appearance]?.[token] ?? null
}
