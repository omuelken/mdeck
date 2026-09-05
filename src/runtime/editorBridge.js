// Editor-mode rendering loop for the deck runtime, kept free of DOM access so
// it can be tested in Node. The editor pushes whole sources; the bridge
// parses, reloads the theme only when deck settings changed, mounts, and
// reports diagnostics back. Nothing here throws on a broken deck.

export function createEditorBridge({ parse, validate = () => [], loadTheme, setCalloutLabels = () => {}, applyOverrides = config => config, mount, post = () => {}, fallbackDesign = 'neue' }) {
  let appliedConfig = null
  let themeConfig = null
  let current = { deck: null, deckConfig: null }
  let running = null
  let pending = null

  async function run(source, selection) {
    const deck = parse(source)
    const runtime = []
    const requested = applyOverrides(deck.deckConfig)
    const key = JSON.stringify(requested)
    if (key !== appliedConfig) {
      setCalloutLabels(requested)
      let config = requested
      try {
        await loadTheme(config)
      } catch (error) {
        runtime.push({ severity: 'error', code: 'theme-load', message: error.message, line: 1, column: 1 })
        config = { ...requested, design: fallbackDesign }
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
  function render(source, selection) {
    if (running) { pending = { source, selection }; return running }
    running = run(source, selection).finally(() => {
      running = null
      if (pending) { const next = pending; pending = null; render(next.source, next.selection) }
    })
    return running
  }

  function handleMessage(data) {
    if (!data || typeof data !== 'object' || !data.deckSource) return false
    const { source, selection } = data.deckSource
    if (typeof source === 'string') render(source, selection ?? null)
    return true
  }

  return { render, handleMessage, current: () => current }
}
