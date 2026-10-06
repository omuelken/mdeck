import { h } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { loadExtension, saveExtension, deleteExtension } from '../api.js'
import { starterFiles, parseManifest, toModel, toRuntimeManifest, deckHeader, MANIFEST } from '../extensions.js'
import { ExtensionsPanel, NewExtensionDialog } from './ExtensionsPanel.jsx'
import { ExtensionEditor } from './ExtensionEditor.jsx'
import { Preview } from './Preview.jsx'
import { Resizer } from './Resizer.jsx'
import { palettesFor } from '../../extensions/tokens.js'
import { setDeckConfig } from '../../core/editDeck.js'

const SAVE_DELAY = 500

// Palette, theme and layout editing. Unsaved palettes and themes are
// previewed live through runtime overrides; layout code shows up after
// they are saved and the preview frame reloads.
export function ExtensionsMode({ state, dispatch, edit, previewReload, onResize }) {
  const [current, setCurrent] = useState(null) // { kind, id, source, files, dirty: {} }
  const [status, setStatus] = useState('saved')
  const [error, setError] = useState(null)
  const [dialog, setDialog] = useState(null)
  // The look being tried, as in the presenter view: one theme and one
  // palette. Choosing a theme keeps the palette where the theme offers it;
  // choosing a palette keeps the theme. It starts as the deck's.
  const deckConfig = state.deck.deckConfig
  const [look, setLook] = useState(() => ({ theme: deckConfig.theme ?? 'neue', palette: deckConfig.palette ?? '' }))
  const offers = (themeId, paletteId) => !paletteId || palettesFor(state.manifests.themes[themeId], state.manifests.palettes).some(p => p.id === paletteId)
  const timer = useRef(null)
  const currentRef = useRef(current)
  currentRef.current = current

  const select = async (kind, id) => {
    if (kind === 'theme') setLook(prev => ({ theme: id, palette: offers(id, prev.palette) ? prev.palette : '' }))
    if (kind === 'palette') setLook(prev => ({ ...prev, palette: id }))
    await flush()
    try { setCurrent({ ...(await loadExtension(kind, id)), dirty: {} }); setStatus('saved'); setError(null) } catch (caught) { setError(caught.message) }
  }

  const flush = async () => {
    clearTimeout(timer.current)
    const target = currentRef.current
    if (!target || !Object.keys(target.dirty).length) return
    setStatus('saving')
    try {
      const result = await saveExtension(target.kind, target.id, target.dirty)
      dispatch({ type: 'setRegistry', registry: result.registry })
      setCurrent(prev => prev && prev.id === target.id ? { ...prev, dirty: Object.fromEntries(Object.entries(prev.dirty).filter(([name, text]) => target.dirty[name] !== text)) } : prev)
      setStatus('saved'); setError(null)
    } catch (caught) { setStatus('error'); setError(caught.message) }
  }

  const onFiles = patch => {
    setCurrent(prev => {
      const files = { ...prev.files }
      for (const [name, text] of Object.entries(patch)) { if (text === null) delete files[name]; else files[name] = text }
      return { ...prev, files, dirty: { ...prev.dirty, ...patch } }
    })
    setStatus('unsaved')
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, SAVE_DELAY)
  }

  const create = async ({ kind, id, title, from }) => {
    setDialog(null)
    const manifest = from ? state.manifests[`${kind}s`][from] : null
    let fromFiles = {}
    if (from) { try { fromFiles = (await loadExtension(kind, from)).files } catch {} }
    const files = starterFiles(kind, id, title, manifest, fromFiles)
    try {
      const result = await saveExtension(kind, id, files)
      dispatch({ type: 'setRegistry', registry: result.registry })
      setCurrent({ kind, id, source: 'local', dir: result.dir, files: result.files, dirty: {} }); setStatus('saved'); setError(null)
      if (kind === 'layout') previewReload()
    } catch (caught) { setError(caught.message) }
  }

  const remove = async () => {
    const target = current
    try {
      const result = await deleteExtension(target.kind, target.id)
      dispatch({ type: 'setRegistry', registry: result.registry })
      setCurrent(null)
      if (target.kind === 'layout') previewReload()
    } catch (caught) { setError(caught.message) }
  }

  useEffect(() => () => clearTimeout(timer.current), [])
  // Extension files changed on disk: pick up the new contents unless local
  // edits are still waiting to be saved.
  useEffect(() => {
    const target = currentRef.current
    if (!state.previewKey || !target || Object.keys(target.dirty).length) return
    loadExtension(target.kind, target.id).then(fresh => setCurrent(prev => prev && prev.id === target.id && !Object.keys(prev.dirty).length ? { ...prev, ...fresh, dirty: {} } : prev)).catch(() => {})
  }, [state.previewKey])
  useEffect(() => { const handler = () => flush(); window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler) }, [])

  // Preview: the deck as it is, viewed with the extension being edited.
  const model = current?.files?.[MANIFEST] ? (parseManifest(current.files[MANIFEST]).raw ? toModel({ ...parseManifest(current.files[MANIFEST]).raw, kind: current.kind }) : null) : null
  let source = state.source, overrides = null, note = null
  const themes = state.manifests.themes
  const lookTheme = themes[look.theme] ?? themes.neue
  const offered = new Set(lookTheme ? palettesFor(lookTheme, state.manifests.palettes).map(p => p.id) : Object.keys(state.manifests.palettes))
  const config = { theme: lookTheme?.id ?? look.theme, palette: look.palette }
  if (current && model) {
    if (current.kind === 'palette') {
      overrides = { palettes: { [current.id]: toRuntimeManifest(model) } }
      // A theme that offers only its own palettes (FHNW) shows those instead.
      if (lookTheme && !offered.has(current.id)) note = `${lookTheme.title} offers only its own colours, so the preview shows those. Choose another theme to see ${model.title || current.id}.`
    }
    if (current.kind === 'theme') { overrides = { themes: { [current.id]: { manifest: toRuntimeManifest(model), styles: current.files['styles.css'] ?? '' } } } }
    if (current.kind === 'layout') source = deckHeader(state.deck) + '\n---\n' + (current.files['starter.md'] ?? `:::meta\nlayout: ${current.id}\n:::\n# ${model.title}\n`)
  }
  const palette = (look.palette && offered.has(look.palette) ? state.manifests.palettes[look.palette] : null) ?? state.manifests.palettes[lookTheme?.palette]
  const deckPalette = deckConfig.palette && offers(deckConfig.theme ?? 'neue', deckConfig.palette) ? deckConfig.palette : themes[deckConfig.theme ?? 'neue']?.palette
  const inDeck = (deckConfig.theme ?? 'neue') === lookTheme?.id && deckPalette === palette?.id
  const useLook = () => edit(d => setDeckConfig(d, { theme: lookTheme.id, palette: palette && palette.id !== lookTheme.palette ? palette.id : undefined }), { group: 'deck:look' })
  const bar = <>
    <span class="preview-look">{lookTheme?.title ?? look.theme} <span class="muted">with</span> {palette?.title ?? 'its colours'}</span>
    <span class="spacer" />
    {inDeck
      ? <span class="muted">The deck's look</span>
      : <><button class="btn is-small" onClick={() => setLook({ theme: deckConfig.theme ?? 'neue', palette: deckConfig.palette ?? '' })}>Back to the deck's</button>
        <button class="btn is-small is-primary" onClick={useLook}>Use for this deck</button></>}
  </>
  const existing = new Set(Object.values(state.manifests).flatMap(byId => Object.keys(byId)))

  return <>
    <ExtensionsPanel registry={state.registry} offered={offered} look={{ theme: lookTheme?.id, palette: palette?.id }} selected={current} onSelect={select} onCreate={kind => setDialog({ kind })} />
    <Preview source={source} selection={{ index: 0, slideId: null }} config={config} overrides={overrides} bar={bar} reloadKey={state.previewKey}
      width={state.deck.deckConfig.width ?? 1920} height={state.deck.deckConfig.height ?? 1080} onState={() => {}} onRendered={info => dispatch({ type: 'previewRendered', ...info })} />
    <aside class="editor-panel">
      <Resizer onResize={onResize} />
      {current
        ? <ExtensionEditor extension={current} status={status} error={error} note={note} onFiles={onFiles} onDelete={remove} onCopy={() => setDialog({ kind: current.kind, initial: { from: current.id, title: `${current.files[MANIFEST]?.match(/^title = "(.*)"$/m)?.[1] ?? current.id} copy`, id: `${current.id}-copy` } })} />
        : <div class="form"><p class="empty">Pick a palette, theme or layout on the left, or create a new one.{error ? ` ${error}` : ''}</p></div>}
    </aside>
    {dialog && <NewExtensionDialog kind={dialog.kind} initial={dialog.initial ?? null} registry={state.registry} existing={existing} onCreate={create} onClose={() => setDialog(null)} />}
  </>
}
