// Pure appearance resolution shared by the runtime and tests. Precedence:
// theme tokens → palette tokens → deck params → explicit accent overrides.
import { tokensToCss } from './tokens.js'

export const DARK_TOKENS = {
  '--logo-filter':    'invert(1)',
  '--token-default':  '#e2e8f0',
  '--token-comment':  '#718096',
  '--token-string':   '#68d391',
  '--token-number':   '#fc8181',
  '--token-keyword':  '#90cdf4',
  '--token-function': '#d6bcfa',
  '--token-operator': '#fbd38d',
}

export function buildAppearance({ theme, palette = null, paletteId = '', params = {}, accent, accent2, meta = {}, offline = false } = {}) {
  if (!theme) throw new Error('A theme manifest is required')
  const warnings = []
  const themeCss = tokensToCss(theme.tokens)

  let paletteTokens = null
  if (palette) paletteTokens = { ...(palette.dark ? DARK_TOKENS : {}), ...palette.tokens }
  else if (paletteId) warnings.push(`Unknown palette "${paletteId}"`)
  else if (theme.dark) paletteTokens = { ...DARK_TOKENS }
  const paletteCss = paletteTokens ? tokensToCss(paletteTokens) : ''

  const overrides = {}
  for (const [name, value] of Object.entries(params ?? {})) {
    const param = theme.params?.[name]
    if (param) overrides[param.token] = value
    else warnings.push(`Theme "${theme.id}" has no parameter "${name}"`)
  }
  if (accent) overrides['--accent'] = accent
  if (accent2) overrides['--accent-2'] = accent2
  for (const [key, value] of Object.entries(meta ?? {})) overrides[`--meta-${key}`] = JSON.stringify(String(value))
  const overridesCss = tokensToCss(overrides)

  // Offline-ready builds deliberately use the declared system-font fallbacks.
  const fonts = offline ? [] : theme.fonts ?? []
  return { themeCss, paletteCss, overridesCss, fonts, warnings }
}

// Effective token value after precedence, for UI controls such as color pickers.
export function effectiveToken(token, { theme, palette, params = {}, accent, accent2 } = {}) {
  if (token === '--accent' && accent) return accent
  if (token === '--accent-2' && accent2) return accent2
  for (const [name, value] of Object.entries(params ?? {})) if (theme?.params?.[name]?.token === token) return value
  if (palette?.tokens?.[token]) return palette.tokens[token]
  if (token === '--accent-2' && theme?.accent2Preview) return theme.accent2Preview
  return theme?.tokens?.[token] ?? null
}
