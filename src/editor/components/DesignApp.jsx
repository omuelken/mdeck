import { h } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { useDeckDocument } from '../useDeckDocument.js'
import { loadExtension, saveExtension, deleteExtension, installPackage, removePackage } from '../api.js'
import { starterFiles, parseManifest, toModel, toRuntimeManifest, MANIFEST } from '../extensions.js'
import { sampleDeck, sampleDataUrl } from '../sampleDeck.js'
import { parseTarget, launchPageUrl } from '../designLink.js'
import { palettesFor } from '../../extensions/tokens.js'
import { parseSlides } from '../../core/parseSlides.js'
import { setDeckConfig } from '../../core/editDeck.js'
import { Icon } from '../../components/Icon.jsx'
import { ExtensionsPanel, NewExtensionDialog } from './ExtensionsPanel.jsx'
import { ExtensionEditor, BuiltInCard } from './ExtensionEditor.jsx'
import { Preview } from './Preview.jsx'
import { ConflictBanner } from './ConflictBanner.jsx'
import { Resizer, readInspectorWidth, storeInspectorWidth } from './Resizer.jsx'
import markUrl from '../../../assets/logo/mark.svg'

const SAVE_DELAY = 500
const SAMPLE = sampleDeck(sampleDataUrl())

// The design page: makes and changes the deck's own themes and palettes,
// previewed on a sample deck with every kind of slide, or on the deck itself.
// Layouts are code, written by hand or by an assistant, not here. Choosing the deck's look happens in the editor's Deck
// settings; here a finished theme or palette can be put to use in one step.
export function DesignApp() {
  const { state, dispatch, edit, resolve, loadError, previewKey } = useDeckDocument()
  const [current, setCurrent] = useState(null) // { kind, id, source, files, dirty: {} }
  const [status, setStatus] = useState('saved')
  const [error, setError] = useState(null)
  const [dialog, setDialog] = useState(null)
  // What the preview shows around the extension being edited: a theme, a
  // palette and light or dark, starting as the deck's.
  const [view, setView] = useState(null)
  const [onDeck, setOnDeck] = useState(false)
  const [slide, setSlide] = useState(0)
  const [inspectorWidth, setInspectorWidth] = useState(readInspectorWidth)
  const resize = width => { setInspectorWidth(width); storeInspectorWidth(width) }
  const [home] = useState(launchPageUrl)
  const timer = useRef(null)
  const currentRef = useRef(current)
  currentRef.current = current
  const { manifests } = state
  const deckConfig = state.deck?.deckConfig ?? {}
  const offers = (theme, paletteId) => !paletteId || !theme || palettesFor(theme, manifests.palettes).some(p => p.id === paletteId)

  // A theme to show a palette in: the given one where it offers it, else the
  // palette's own theme, else the first that offers it.
  const themeFor = (paletteId, preferred) => {
    const palette = manifests.palettes[paletteId]
    if (offers(manifests.themes[preferred], paletteId)) return preferred
    if (palette?.theme && manifests.themes[palette.theme]) return palette.theme
    return Object.values(manifests.themes).find(t => offers(t, paletteId))?.id ?? preferred
  }

  // The preview follows the extension opened: a theme is shown with the
  // palette where it offers it, a palette in a theme that offers it.
  const follow = (kind, id) => setView(prev => {
    if (kind === 'theme') return { ...prev, theme: id, palette: offers(manifests.themes[id], prev.palette) ? prev.palette : '' }
    if (kind === 'palette') {
      return { ...prev, theme: themeFor(id, prev.theme), palette: id }
    }
    return prev
  })

  const show = (kind, id, extension) => {
    setCurrent({ ...extension, dirty: {} }); setStatus('saved'); setError(null)
    follow(kind, id)
  }

  const select = async (kind, id) => {
    await flush()
    try { show(kind, id, await loadExtension(kind, id)) } catch (caught) { setError(caught.message) }
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

  const existing = new Set(Object.values(manifests).flatMap(byId => Object.keys(byId)))
  const freeId = base => { let id = base, n = 2; while (existing.has(id)) id = `${base}-${n++}`; return id }
  const copyDialog = (kind, from) => {
    const item = manifests[`${kind}s`][from]
    setDialog({ kind, initial: { from, title: `${item?.title ?? from} (custom)`, id: freeId(`${from}-custom`) } })
  }

  const create = async ({ kind, id, title, from }) => {
    setDialog(null)
    await flush()
    const manifest = from ? manifests[`${kind}s`][from] : null
    let fromFiles = {}
    if (from) { try { fromFiles = (await loadExtension(kind, from)).files } catch {} }
    const files = starterFiles(kind, id, title, manifest, fromFiles)
    try {
      const result = await saveExtension(kind, id, files)
      dispatch({ type: 'setRegistry', registry: result.registry })
      show(kind, id, { kind, id, source: 'local', dir: result.dir, files: result.files })
    } catch (caught) { setError(caught.message) }
  }

  // A theme or palette installed for every deck, then opened.
  const installOnline = async (kind, id) => {
    const result = await installPackage(kind, id)
    dispatch({ type: 'setRegistry', registry: result.registry })
    await select(kind, id)
  }

  // Removes a theme or palette for every deck; the deck's look is not changed.
  const removeOnline = async (kind, id) => {
    const result = await removePackage(kind, id)
    dispatch({ type: 'setRegistry', registry: result.registry })
    setCurrent(null)
  }

  const remove = async () => {
    const target = current
    try {
      const result = await deleteExtension(target.kind, target.id)
      dispatch({ type: 'setRegistry', registry: result.registry })
      setCurrent(null)
    } catch (caught) { setError(caught.message) }
  }

  // Once the deck is loaded: start from its look, then follow the link that
  // opened the page (`?open=theme:mine`, `?copy=palette:lagoon`).
  useEffect(() => {
    if (!state.loaded || view) return
    setView({ theme: deckConfig.theme ?? 'neue', palette: deckConfig.palette ?? '', appearance: deckConfig.appearance ?? '' })
    const query = new URLSearchParams(location.search)
    const open = parseTarget(query.get('open')), copy = parseTarget(query.get('copy'))
    if (open || copy) history.replaceState(null, '', location.pathname)
    if (open && open.kind !== 'layout') select(open.kind, open.id)
    if (copy && copy.kind !== 'layout' && manifests[`${copy.kind}s`][copy.id]) { select(copy.kind, copy.id); copyDialog(copy.kind, copy.id) }
  }, [state.loaded])

  useEffect(() => () => clearTimeout(timer.current), [])
  // Extension files changed on disk: pick up the new contents unless local
  // edits are still waiting to be saved.
  useEffect(() => {
    const target = currentRef.current
    if (!previewKey || !target || Object.keys(target.dirty).length) return
    loadExtension(target.kind, target.id).then(fresh => setCurrent(prev => prev && prev.id === target.id && !Object.keys(prev.dirty).length ? { ...prev, ...fresh, dirty: {} } : prev)).catch(() => {})
  }, [previewKey])
  useEffect(() => { const handler = () => flush(); window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler) }, [])
  useEffect(() => { document.title = state.name ? `Design · ${state.name}` : 'mdeck design' }, [state.name])

  if (loadError) return <div class="loading">Could not load the deck: {loadError}</div>
  if (!state.loaded || !view) return <div class="loading">Loading…</div>

  // The preview: unsaved themes and palettes reach it as runtime overrides.
  const parsed = current?.files?.[MANIFEST] ? parseManifest(current.files[MANIFEST]) : null
  const model = parsed?.raw ? toModel({ ...parsed.raw, kind: current.kind }) : null
  const editing = kind => current?.kind === kind && model ? current.id : null
  let overrides = null, note = null
  const themes = manifests.themes
  const themeId = editing('theme') ?? (themes[view.theme] ? view.theme : 'neue')
  const theme = editing('theme') ? toRuntimeManifest(model) : themes[themeId]
  const offered = theme ? palettesFor(theme, manifests.palettes) : Object.values(manifests.palettes)
  const paletteId = editing('palette') ?? (view.palette && offered.some(p => p.id === view.palette) ? view.palette : '')
  if (editing('palette')) {
    overrides = { palettes: { [current.id]: toRuntimeManifest(model) } }
    if (theme && !offered.some(p => p.id === current.id)) note = `${theme.title} offers only its own colours, so the preview shows those. Choose another theme above the preview to see ${model.title || current.id}.`
  }
  if (editing('theme')) overrides = { themes: { [current.id]: { manifest: toRuntimeManifest(model), styles: current.files['styles.css'] ?? '' } } }
  const source = onDeck ? state.source : SAMPLE
  const config = { theme: themeId, palette: paletteId, ...(view.appearance ? { appearance: view.appearance } : {}) }
  const appearance = view.appearance || theme?.appearance || 'light'
  const slideCount = parseSlides(source).slides.length
  const index = Math.min(slide, Math.max(0, slideCount - 1))

  // Whether the deck uses the theme or palette being edited, and the one
  // change that makes it.
  const deckThemeId = deckConfig.theme ?? 'neue'
  const deckTheme = themes[deckThemeId]
  const deckPaletteId = deckConfig.palette && offers(deckTheme, deckConfig.palette) ? deckConfig.palette : deckTheme?.palette
  const inDeck = current?.kind === 'theme' ? deckThemeId === current.id : current?.kind === 'palette' ? deckPaletteId === current.id : false
  const useInDeck = () => {
    if (current.kind === 'theme') edit(d => setDeckConfig(d, { theme: current.id, ...(offers(themes[current.id], deckConfig.palette) ? {} : { palette: undefined }) }), { group: 'design:use' })
    else edit(d => setDeckConfig(d, { palette: current.id, ...(offers(deckTheme, current.id) ? {} : { theme: themeId }) }), { group: 'design:use' })
  }

  const bar = <>
    {!state.designOnly && <div class="segmented" role="group" aria-label="Preview on">
      <button type="button" class={!onDeck ? 'is-active' : ''} aria-pressed={!onDeck} onClick={() => { setOnDeck(false); setSlide(0) }}>Sample deck</button>
      <button type="button" class={onDeck ? 'is-active' : ''} aria-pressed={onDeck} onClick={() => { setOnDeck(true); setSlide(0) }}>My deck</button>
    </div>}
    <span class="spacer" />
    <label class="preview-choice">Theme
      <select value={themeId} disabled={Boolean(editing('theme'))} onChange={e => follow('theme', e.currentTarget.value)}>
        {editing('theme') && !themes[themeId] && <option value={themeId}>{model.title || themeId}</option>}
        {Object.values(themes).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
      </select>
    </label>
    <label class="preview-choice">Palette
      <select value={paletteId} disabled={Boolean(editing('palette'))} onChange={e => setView(prev => ({ ...prev, palette: e.currentTarget.value }))}>
        <option value="">{theme?.palette && manifests.palettes[theme.palette] ? `${manifests.palettes[theme.palette].title} (theme default)` : 'Theme default'}</option>
        {editing('palette') && !offered.some(p => p.id === current.id) && <option value={current.id}>{model.title || current.id}</option>}
        {offered.filter(p => p.id !== theme?.palette).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
      </select>
    </label>
    <div class="appearance-toggle is-compact" role="group" aria-label="Light or dark">
      {['light', 'dark'].map(mode => <button type="button" key={mode} title={mode === 'light' ? 'Light' : 'Dark'} aria-label={mode === 'light' ? 'Light' : 'Dark'} aria-pressed={appearance === mode}
        class={`btn is-small is-icon${appearance === mode ? ' is-active' : ''}`} onClick={() => setView(prev => ({ ...prev, appearance: mode }))}><Icon name={mode === 'light' ? 'sun' : 'moon'} size={14} /></button>)}
    </div>
  </>

  const usage = !state.designOnly && current && current.source === 'local' && <div class="design-usage">
    {inDeck
      ? <span><Icon name="check" size={14} /> The deck uses this {current.kind}.</span>
      : <><span class="muted">The deck does not use this {current.kind}.</span><button class="btn is-small is-primary" onClick={useInDeck}>Use in my deck</button></>}
  </div>

  return <div class="editor">
    <header class="editor-topbar">
      <img src={markUrl} alt="" width="22" height="22" style={{ borderRadius: '5px' }} />
      <h1 title={state.path}>Design <span class="muted">· {state.name}</span></h1>
      <span class="spacer" />
      {state.designOnly
        ? <span class="muted" title={`${state.path}/extensions`}>Saved in {state.name}/extensions</span>
        : <a class="btn is-small" href="/editor.html">Back to the slides</a>}
      {home && <a class="btn is-small" href={home}>Launch page</a>}
    </header>
    {state.status === 'conflict' && <ConflictBanner onReload={() => resolve('reload')} onOverwrite={() => resolve('overwrite')} />}
    <div class="editor-main" style={{ gridTemplateColumns: `290px minmax(0, 1fr) ${inspectorWidth}px` }}>
      <ExtensionsPanel registry={state.registry} owner={state.designOnly ? "This folder's" : "This deck's"} view={{ appearance, themeFor: id => themeFor(id, themeId), paletteFor: id => offers(themes[id], paletteId) ? paletteId : '' }} selected={current} onSelect={select} onCreate={kind => setDialog({ kind })} onInstall={installOnline} />
      <Preview source={source} selection={{ index, slideId: null }} config={config} overrides={overrides} bar={bar} reloadKey={previewKey} total={slideCount}
        width={deckConfig.width ?? 1920} height={deckConfig.height ?? 1080} onState={setSlide} onRendered={info => dispatch({ type: 'previewRendered', ...info })} />
      <aside class="editor-panel">
        <Resizer onResize={resize} />
        {!current
          ? <div class="form"><p class="empty">Choose one of {state.designOnly ? "this folder's" : "this deck's"} themes and palettes on the left to change it, or start from a built-in one. What you change is saved as you type, in the <code>extensions</code> folder {state.designOnly ? 'of this folder, where decks in it find them' : "beside the deck. The deck's look is chosen in the editor's Deck settings"}.{error ? ` ${error}` : ''}</p></div>
          : current.source === 'local'
            ? <>{usage}<ExtensionEditor extension={current} palettes={manifests.palettes} status={status} error={error} note={note} onFiles={onFiles} onDelete={remove} onCopy={() => copyDialog(current.kind, current.id)} /></>
            : <BuiltInCard extension={current} manifest={manifests[`${current.kind}s`][current.id]} onCopy={() => copyDialog(current.kind, current.id)} onRemove={removeOnline} />}
      </aside>
    </div>
    {dialog && <NewExtensionDialog kind={dialog.kind} initial={dialog.initial ?? null} registry={state.registry} existing={existing} onCreate={create} onClose={() => setDialog(null)} />}
  </div>
}
