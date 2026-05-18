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
  modern:    () => import('../themes/modern/index.js'),
  clarity:   () => import('../themes/clarity/index.js'),
  fhnw:      () => import('../themes/fhnw/index.js'),
  editorial: () => import('../themes/editorial/index.js'),
}

const PALETTES = Object.fromEntries(
  Object.entries(import.meta.glob('../palettes/*.json', { eager: true }))
    .map(([path, mod]) => [
      path.replace('../palettes/', '').replace('.json', ''),
      mod.default ?? mod,
    ])
)

export const THEME_NAMES = Object.keys(THEMES)
export const PALETTE_NAMES = Object.keys(PALETTES)

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

export async function loadTheme({ design = 'modern', palette, accent, params = {}, meta = {} } = {}) {
  const loader = THEMES[design]
  if (!loader) throw new Error(`Unknown theme: "${design}". Available: ${Object.keys(THEMES).join(', ')}`)

  const { tokensCSS, templatesCSS, themeMeta } = await loader()

  // Inject base theme CSS
  upsertStyle('deck-theme', tokensCSS + '\n' + templatesCSS)

  // Load theme fonts
  syncThemeFonts(themeMeta.fonts)

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
  } else {
    upsertStyle('deck-palette', '')
  }

  // Build override vars: user params + deck meta values
  const overrides = []

  for (const [paramName, value] of Object.entries(params)) {
    const def = themeMeta.params?.[paramName]
    if (def) overrides.push(`${def.token}: ${value};`)
  }

  if (accent) overrides.push(`--accent: ${accent};`)

  for (const [key, value] of Object.entries(meta)) {
    overrides.push(`--meta-${key}: ${JSON.stringify(String(value))};`)
  }

  if (overrides.length) {
    upsertStyle('deck-overrides', `:root {\n  ${overrides.join('\n  ')}\n}`)
  } else {
    upsertStyle('deck-overrides', '')
  }
}
