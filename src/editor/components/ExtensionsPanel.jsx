import { h } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { ID_RE } from '../extensions.js'
import { Icon } from '../../components/Icon.jsx'
import { LookThumbnail } from './LookThumbnail.jsx'
import { loadThemeIndex } from '../api.js'

const KINDS = [['theme', 'Themes'], ['palette', 'Palettes']]

// The deck's own themes or palettes, to change; those installed for every
// deck; packs from the theme repository; and the built-in ones to start
// from. A new theme always starts as a copy; a palette can also start from
// readable plain colours. The pictures show the sample deck as `view` says:
// palettes in the preview's theme where it offers them, themes with its
// palette where they offer it, both in its light or dark.
export function ExtensionsPanel({ registry, view = {}, owner = "This deck's", selected, onSelect, onCreate, onInstall }) {
  const [kind, setKind] = useState(selected?.kind ?? 'theme')
  useEffect(() => { if (selected?.kind) setKind(selected.kind) }, [selected?.kind])
  const items = registry?.[`${kind}s`] ?? []
  const own = items.filter(item => item.source === 'local')
  const installed = items.filter(item => item.source === 'user')
  const builtIn = items.filter(item => item.source === 'built-in')
  const name = `${kind}s`
  const row = item => <li key={item.id} class={`outline-item has-thumb${selected?.kind === kind && selected?.id === item.id ? ' is-selected' : ''}`}
    onClick={() => onSelect(kind, item.id)} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
    {kind === 'theme' && <LookThumbnail sample theme={item.id} palette={view.paletteFor?.(item.id) ?? ''} appearance={view.appearance} />}
    {kind === 'palette' && <LookThumbnail sample theme={view.themeFor?.(item.id) ?? ''} palette={item.id} appearance={view.appearance} />}
    <span><span class="title" style={{ display: 'block' }}>{item.title}</span><span class="layout">{item.id}</span></span>
  </li>
  return <aside class="editor-panel">
    <div class="editor-panel-head extensions-tabs">
      <div class="tabs">{KINDS.map(([id, label]) => <button key={id} class={kind === id ? 'is-active' : ''} onClick={() => setKind(id)}>{label}</button>)}</div>
    </div>
    <div class="panel-section-head">
      <p class="section-title">{owner} {name}</p>
      {kind === 'palette' && <button class="btn is-small is-icon" title="New palette" aria-label="New palette" onClick={() => onCreate(kind)}><Icon name="add" size={14} /></button>}
    </div>
    {own.length
      ? <ol class="outline-list">{own.map(row)}</ol>
      : <p class="panel-hint">None yet. Start from a built-in one below{kind === 'palette' ? ', or with + from plain colours' : ''}.</p>}
    {installed.length > 0 && <>
      <div class="panel-section-head"><p class="section-title">Installed for every deck</p></div>
      <ol class="outline-list">{installed.map(row)}</ol>
    </>}
    <OnlinePacks key="online" kind={kind} owner={owner} onInstall={onInstall} />
    <div class="panel-section-head"><p class="section-title">Built in, to start from</p></div>
    <ol class="outline-list">{builtIn.map(row)}</ol>
  </aside>
}

// Packs from the theme repository with this kind of extension, loaded on
// request since it needs the network. Installing puts a pack beside the deck.
function OnlinePacks({ kind, owner, onInstall }) {
  const [state, setState] = useState({ status: 'idle' })
  const [busy, setBusy] = useState(null)
  const load = () => {
    setState({ status: 'loading' })
    loadThemeIndex().then(index => setState({ status: 'ready', index }), error => setState({ status: 'error', error: error.message }))
  }
  const install = async pack => {
    setBusy(pack.id)
    try {
      await onInstall(pack, kind)
      setState(prev => ({ ...prev, index: { ...prev.index, installed: { ...prev.index.installed, [pack.id]: { version: pack.version } } } }))
    } catch (error) { setState(prev => ({ ...prev, error: error.message })) }
    setBusy(null)
  }
  const head = <div class="panel-section-head"><p class="section-title">From the theme repository</p></div>
  if (state.status !== 'ready') return <>{head}<div class="panel-hint">
    {state.status === 'loading' ? 'Loading…' : <button class="btn is-small" onClick={load}>Show what others made</button>}
    {state.error && <p class="online-error">{state.error}</p>}
  </div></>
  const { index } = state
  const packs = index.packs.filter(pack => pack[`${kind}s`].length)
  return <>{head}
    {state.error && <p class="panel-hint online-error">{state.error}</p>}
    {!packs.length && <p class="panel-hint">No {kind}s there yet.</p>}
    <ol class="outline-list">{packs.map(pack => {
      const id = pack[`${kind}s`][0]
      const have = index.installed?.[pack.id]
      return <li key={pack.id} class="outline-item has-thumb online-pack">
        {pack.previews?.[id] && <div class="thumb"><img src={new URL(pack.previews[id], index.url).href} alt="" loading="lazy" /></div>}
        <span><span class="title" style={{ display: 'block' }}>{pack.title} <span class="muted">{pack.version}</span></span>
          <span class="online-meta">{[...pack.themes, ...pack.palettes].join(', ')} · {pack.author}</span></span>
        {have
          ? <span class="muted">{`Installed${have.version !== pack.version ? ` (${have.version})` : ''} in ${owner === "This folder's" ? 'this folder' : 'this deck'}`}</span>
          : <button class="btn is-small" disabled={busy === pack.id} onClick={() => install(pack)}>{busy === pack.id ? 'Installing…' : 'Install'}</button>}
      </li>
    })}</ol>
  </>
}

export function NewExtensionDialog({ kind, registry, existing, onCreate, onClose, initial = null }) {
  const [id, setId] = useState(initial?.id ?? '')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [from, setFrom] = useState(initial?.from ?? '')
  const taken = existing.has(id)
  const valid = ID_RE.test(id) && !taken && title.trim() && (from || kind !== 'theme')
  const options = registry?.[`${kind}s`] ?? []
  return <div class="modal-scrim" onClick={onClose}>
    <div class="modal" onClick={event => event.stopPropagation()}>
      <h2>New {kind}</h2>
      <div class="form" style={{ padding: 0 }}>
        <div class="field"><label>Title</label><input type="text" value={title} autofocus onInput={e => { setTitle(e.currentTarget.value); if (!initial?.id) setId(e.currentTarget.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/^[^a-z]+/, '')) }} /></div>
        <div class="field"><label>Id <span class="hint">folder name in extensions/</span></label><input type="text" value={id} onInput={e => setId(e.currentTarget.value)} />{id && !ID_RE.test(id) && <span class="error">Use lowercase letters, digits and hyphens, starting with a letter</span>}{taken && <span class="error">That id is already in use</span>}</div>
        <div class="field"><label>Start from</label><select value={from} onChange={e => setFrom(e.currentTarget.value)}>{kind !== 'theme' && <option value="">Plain colours</option>}{options.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div>
        <div class="row" style={{ display: 'flex', gap: '8px' }}>
          <button class="btn is-primary" disabled={!valid} onClick={() => onCreate({ kind, id, title: title.trim(), from: from || null })}>Create</button>
          <button class="btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  </div>
}
