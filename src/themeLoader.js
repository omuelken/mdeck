const DARK_TOKENS = {
  '--token-default':  '#e2e8f0',
  '--token-comment':  '#718096',
  '--token-string':   '#68d391',
  '--token-number':   '#fc8181',
  '--token-keyword':  '#90cdf4',
  '--token-function': '#d6bcfa',
  '--token-operator': '#fbd38d',
}

const THEMES = {
  modern:  () => import('../themes/modern/index.js'),
  clarity: () => import('../themes/clarity/index.js'),
}

const PALETTES = Object.fromEntries(
  Object.entries(import.meta.glob('../palettes/*.json', { eager: true }))
    .map(([path, mod]) => [
      path.replace('../palettes/', '').replace('.json', ''),
      mod.default ?? mod,
    ])
)

export async function loadTheme({ design = 'modern', palette, params = {}, meta = {} } = {}) {
  const loader = THEMES[design]
  if (!loader) throw new Error(`Unknown theme: "${design}". Available: ${Object.keys(THEMES).join(', ')}`)

  const { tokensCSS, templatesCSS, themeMeta } = await loader()

  // Inject base theme CSS
  const baseStyle = document.createElement('style')
  baseStyle.id = 'deck-theme'
  baseStyle.textContent = tokensCSS + '\n' + templatesCSS
  document.head.appendChild(baseStyle)

  // Load theme fonts
  for (const fontUrl of themeMeta.fonts ?? []) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = fontUrl
    document.head.appendChild(link)
  }

  // Inject palette overrides (sits between base tokens and per-deck params)
  const resolvedPalette = palette ? PALETTES[palette] : null
  if (resolvedPalette) {
    const allVars = {}
    if (resolvedPalette.dark) Object.assign(allVars, DARK_TOKENS)
    Object.assign(allVars, resolvedPalette.tokens)
    const paletteStyle = document.createElement('style')
    paletteStyle.id = 'deck-palette'
    paletteStyle.textContent = `:root {\n  ${Object.entries(allVars).map(([k, v]) => `${k}: ${v};`).join('\n  ')}\n}`
    document.head.appendChild(paletteStyle)
  } else if (palette) {
    console.warn(`Unknown palette "${palette}". Available: ${Object.keys(PALETTES).join(', ')}`)
  }

  // Build override vars: user params + deck meta values
  const overrides = []

  for (const [paramName, value] of Object.entries(params)) {
    const def = themeMeta.params?.[paramName]
    if (def) overrides.push(`${def.token}: ${value};`)
  }

  for (const [key, value] of Object.entries(meta)) {
    overrides.push(`--meta-${key}: ${JSON.stringify(String(value))};`)
  }

  if (overrides.length) {
    const overrideStyle = document.createElement('style')
    overrideStyle.id = 'deck-overrides'
    overrideStyle.textContent = `:root {\n  ${overrides.join('\n  ')}\n}`
    document.head.appendChild(overrideStyle)
  }
}
