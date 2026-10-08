// Editor-mode rendering loop for the deck runtime, kept free of DOM access so
// it can be tested in Node. The editor pushes whole sources; the bridge
// parses, reloads the theme only when deck settings changed, mounts, and
// reports diagnostics back. Nothing here throws on a broken deck.

export function createEditorBridge({ parse, validate = () => [], loadTheme, setExtensionOverrides = () => {}, setCalloutLabels = () => {}, applyOverrides = config => config, mount, post = () => {}, fallbackTheme = 'neue' }) {
  let appliedConfig = null
  let themeConfig = null
  let current = { deck: null, deckConfig: null }
  let running = null
  let pending = null

  // `config` merges over the deck's own settings (e.g. to preview a palette);
  // `overrides` carries unsaved theme and palette manifests.
  async function run(source, { selection = null, config = null, overrides = null } = {}) {
    const deck = parse(source)
    const runtime = []
    const requested = applyOverrides({ ...deck.deckConfig, ...(config ?? {}) })
    const key = JSON.stringify({ requested, overrides })
    if (key !== appliedConfig) {
      setExtensionOverrides(overrides ?? {})
      setCalloutLabels(requested)
      let config = requested
      try {
        await loadTheme(config)
      } catch (error) {
        runtime.push({ severity: 'error', code: 'theme-load', message: error.message, line: 1, column: 1 })
        config = { ...requested, theme: fallbackTheme }
        try { await loadTheme(config) } catch {}
      }
      appliedConfig = key
      themeConfig = config
    }
    let error = null
    try { mount({ deck, deckConfig: themeConfig, selection }) } catch (caught) { error = caught?.message ?? String(caught) }
    current = { deck, deckConfig: themeConfig }
    post({ deckRendered: { slideCount: deck.slides.length, diagnostics: [...deck.diagnostics, ...validate(deck), ...runtime], error } })
  }

  // Renders are serialized; while one is in flight only the newest request waits.
  let latest = null
  function render(source, options = {}) {
    latest = { source, options }
    if (running) { pending = { source, options }; return running }
    running = run(source, options).finally(() => {
      running = null
      if (pending) { const next = pending; pending = null; render(next.source, next.options) }
    })
    return running
  }

  function handleMessage(data) {
    if (!data || typeof data !== 'object' || !data.deckSource) return false
    const { source, selection, config, overrides } = data.deckSource
    if (typeof source === 'string') render(source, { selection: selection ?? null, config: config ?? null, overrides: overrides ?? null })
    return true
  }

  // The newest request again, with its preview settings, e.g. after the
  // references were reformatted.
  const refresh = () => latest ? render(latest.source, latest.options) : null

  return { render, refresh, handleMessage, current: () => current }
}
