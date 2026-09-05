import baseCSS from '../../assets/themes/base.css?inline'

const SELF_CONTAINED = typeof __MDECK_SELF_CONTAINED__ !== 'undefined'
  && __MDECK_SELF_CONTAINED__

const DARK_TOKENS = {
  '--logo-filter':    'invert(1)',
  '--token-default':  '#e2e8f0',
  '--token-comment':  '#718096',
  '--token-string':   '#68d391',
  '--token-number':   '#fc8181',
  '--token-keyword':  '#90cdf4',
  '--token-function': '#d6bcfa',
  '--token-operator': '#fbd38d',
}

const THEMES = {
  neue:      () => import('../../assets/themes/neue/index.js'),
  aurora:    () => import('../../assets/themes/aurora/index.js'),
  duet:      () => import('../../assets/themes/duet/index.js'),
  fhnw:      () => import('../../assets/themes/fhnw/index.js'),
  editorial: () => import('../../assets/themes/editorial/index.js'),
  terminal:  () => import('../../assets/themes/terminal/index.js'),
}

const PALETTES = Object.fromEntries(
  Object.entries(import.meta.glob('../../assets/palettes/*.json', { eager: true }))
    .map(([path, mod]) => [
      path.split('/').at(-1).replace('.json', ''),
      mod.default ?? mod,
    ])
)

export const THEME_NAMES = Object.keys(THEMES)
export const PALETTE_NAMES = Object.keys(PALETTES)
export { PALETTES }

export const THEME_METAS = Object.fromEntries(
  Object.entries(import.meta.glob('../../assets/themes/*/meta.json', { eager: true }))
    .map(([path, mod]) => {
      const name = path.match(/themes\/([^/]+)\/meta\.json/)?.[1]
      return [name, mod.default ?? mod]
    })
    .filter(([name]) => name)
)

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
  const loader = THEMES[design]
  if (!loader) throw new Error(`Unknown theme: "${design}". Available: ${Object.keys(THEMES).join(', ')}`)

  const { tokensCSS, templatesCSS, themeMeta } = await loader()

  // Inject base theme CSS
  upsertStyle('deck-theme', baseCSS + '\n' + tokensCSS + '\n' + templatesCSS)

  // Offline-ready builds deliberately use the declared system-font fallbacks.
  // Normal dev and bundle builds keep the authored web fonts.
  syncThemeFonts(SELF_CONTAINED ? [] : themeMeta.fonts)

  // Inject palette overrides (sits between base tokens and per-deck params)
  const resolvedPalette = palette ? PALETTES[palette] : null
  if (resolvedPalette) {
    const allVars = {}
    if (resolvedPalette.dark) Object.assign(allVars, DARK_TOKENS)
    Object.assign(allVars, resolvedPalette.tokens)
    upsertStyle('deck-palette', `:root {\n  ${Object.entries(allVars).map(([k, v]) => `${k}: ${v};`).join('\n  ')}\n}`)
  } else if (palette) {
    console.warn(`Unknown palette "${palette}". Available: ${Object.keys(PALETTES).join(', ')}`)
    upsertStyle('deck-palette', '')
  } else if (themeMeta.dark) {
    // Dark-by-default theme with no palette — apply dark utility tokens (syntax colours, logo inversion)
    upsertStyle('deck-palette', `:root {\n  ${Object.entries(DARK_TOKENS).map(([k, v]) => `${k}: ${v};`).join('\n  ')}\n}`)
  } else {
    upsertStyle('deck-palette', '')
  }

  // Build override vars: user params + deck meta values
  const overrides = []

  for (const [paramName, value] of Object.entries(params)) {
    const def = themeMeta.params?.[paramName]
    if (def) overrides.push(`${def.token}: ${value};`)
  }

  if (accent)  overrides.push(`--accent: ${accent};`)
  if (accent2) overrides.push(`--accent-2: ${accent2};`)

  for (const [key, value] of Object.entries(meta)) {
    overrides.push(`--meta-${key}: ${JSON.stringify(String(value))};`)
  }

  if (overrides.length) {
    upsertStyle('deck-overrides', `:root {\n  ${overrides.join('\n  ')}\n}`)
  } else {
    upsertStyle('deck-overrides', '')
  }
}
