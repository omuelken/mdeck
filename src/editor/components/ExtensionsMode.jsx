import { h } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { loadExtension, saveExtension, deleteExtension } from '../api.js'
import { starterFiles, parseManifest, toModel, toRuntimeManifest, deckHeader, MANIFEST } from '../extensions.js'
import { ExtensionsPanel, NewExtensionDialog } from './ExtensionsPanel.jsx'
import { ExtensionEditor } from './ExtensionEditor.jsx'
import { Preview } from './Preview.jsx'

const SAVE_DELAY = 500

// Palette, theme and template editing. Unsaved palettes and themes are
// previewed live through runtime overrides; template layouts show up after
// they are saved and the preview frame reloads.
export function ExtensionsMode({ state, dispatch, previewReload }) {
  const [current, setCurrent] = useState(null) // { kind, id, source, files, dirty: {} }
  const [status, setStatus] = useState('saved')
  const [error, setError] = useState(null)
  const [dialog, setDialog] = useState(null)
  const timer = useRef(null)
  const currentRef = useRef(current)
  currentRef.current = current

  const select = async (kind, id) => {
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
      if (kind === 'template') previewReload()
    } catch (caught) { setError(caught.message) }
  }

  const remove = async () => {
    const target = current
    try {
      const result = await deleteExtension(target.kind, target.id)
      dispatch({ type: 'setRegistry', registry: result.registry })
      setCurrent(null)
      if (target.kind === 'template') previewReload()
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
  let source = state.source, config = null, overrides = null
  if (current && model) {
    if (current.kind === 'palette') { config = { palette: current.id }; overrides = { palettes: { [current.id]: toRuntimeManifest(model) } } }
    if (current.kind === 'theme') { config = { design: current.id, palette: '' }; overrides = { themes: { [current.id]: { manifest: toRuntimeManifest(model), styles: current.files['styles.css'] ?? '' } } } }
    if (current.kind === 'template') source = deckHeader(state.deck) + '\n---\n' + (current.files['starter.md'] ?? `:::meta\nlayout: ${current.id}\n:::\n# ${model.title}\n`)
  }
  const existing = new Set(Object.values(state.manifests).flatMap(byId => Object.keys(byId)))

  return <>
    <ExtensionsPanel registry={state.registry} selected={current} onSelect={select} onCreate={kind => setDialog({ kind })} />
    <Preview source={source} selection={{ index: 0, slideId: null }} config={config} overrides={overrides} reloadKey={state.previewKey}
      width={state.deck.deckConfig.width ?? 1920} height={state.deck.deckConfig.height ?? 1080} onState={() => {}} onRendered={info => dispatch({ type: 'previewRendered', ...info })} />
    <aside class="editor-panel">
      {current
        ? <ExtensionEditor extension={current} status={status} error={error} onFiles={onFiles} onDelete={remove} onCopy={() => setDialog({ kind: current.kind, initial: { from: current.id, title: `${current.files[MANIFEST]?.match(/^title = "(.*)"$/m)?.[1] ?? current.id} copy`, id: `${current.id}-copy` } })} />
        : <div class="form"><p class="empty">Pick a palette, theme or template on the left, or create a new one.{error ? ` ${error}` : ''}</p></div>}
    </aside>
    {dialog && <NewExtensionDialog kind={dialog.kind} initial={dialog.initial ?? null} registry={state.registry} existing={existing} onCreate={create} onClose={() => setDialog(null)} />}
  </>
}
