const THEMES = {
  modern: () => import('../themes/modern/index.js'),
}

export async function loadTheme({ design = 'modern', params = {}, meta = {} } = {}) {
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

  // Build override vars: user params + deck meta values
  const overrides = []

  for (const [paramName, value] of Object.entries(params)) {
    const def = themeMeta.params?.[paramName]
    if (def) overrides.push(`${def.token}: ${value};`)
  }

  for (const [key, value] of Object.entries(meta)) {
    // CSS custom properties accept strings via JSON.stringify for quoted values
    overrides.push(`--meta-${key}: ${JSON.stringify(String(value))};`)
  }

  if (overrides.length) {
    const overrideStyle = document.createElement('style')
    overrideStyle.id = 'deck-overrides'
    overrideStyle.textContent = `:root {\n  ${overrides.join('\n  ')}\n}`
    document.head.appendChild(overrideStyle)
  }
}
