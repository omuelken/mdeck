import { h } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { ID_RE } from '../extensions.js'
import { Icon } from '../../components/Icon.jsx'

const KINDS = [['palette', 'Palettes'], ['theme', 'Themes'], ['layout', 'Layouts']]

export function ExtensionsPanel({ registry, offered, look = {}, selected, onSelect, onCreate }) {
  // One kind at a time, in tabs; the tab follows the extension being edited.
  const [kind, setKind] = useState(selected?.kind ?? 'palette')
  useEffect(() => { if (selected?.kind) setKind(selected.kind) }, [selected?.kind])
  return <aside class="editor-panel">
    <div class="editor-panel-head extensions-tabs">
      <div class="tabs">{KINDS.map(([id, label]) => <button key={id} class={kind === id ? 'is-active' : ''} onClick={() => setKind(id)}>{label}</button>)}</div>
      <button class="btn is-small is-primary is-icon" title={`New ${kind}`} aria-label={`New ${kind}`} onClick={() => onCreate(kind)}><Icon name="add" size={14} /></button>
    </div>
    <ol class="outline-list">
      {(registry?.[`${kind}s`] ?? []).map(item => <li key={item.id} class={`outline-item${kind !== 'layout' ? ' has-thumb' : ''}${kind === 'palette' && offered && !offered.has(item.id) ? ' is-unoffered' : ''}${selected?.kind === kind && selected?.id === item.id ? ' is-selected' : ''}${look[kind] === item.id ? ' is-in-look' : ''}`} title={kind === 'palette' && offered && !offered.has(item.id) ? "The deck's theme does not offer this palette" : undefined} onClick={() => onSelect(kind, item.id)} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
        {kind === 'theme' && <Thumbnail theme={item.id} palette={look.palette} />}
        {kind === 'palette' && <Thumbnail theme={look.theme} palette={item.id} />}
        <span><span class="title" style={{ display: 'block' }}>{item.title}</span><span class="layout">{item.id}{item.source === 'local' ? ' · this deck' : ''}</span></span>
      </li>)}
    </ol>
  </aside>
}

// The deck's first slide in a theme and palette: themes are shown with the
// palette being tried, palettes with the theme being tried, as in the
// presenter view. Light or dark stays the deck's.
function Thumbnail({ theme = '', palette = '' }) {
  return <div class="thumb"><iframe src={`/?embedded=1&theme=${encodeURIComponent(theme)}&palette=${encodeURIComponent(palette)}`} title="" tabIndex={-1} loading="lazy" scrolling="no" /></div>
}

export function NewExtensionDialog({ kind, registry, existing, onCreate, onClose, initial = null }) {
  const [id, setId] = useState(initial?.id ?? '')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [from, setFrom] = useState(initial?.from ?? '')
  const taken = existing.has(id)
  const valid = ID_RE.test(id) && !taken && title.trim()
  const options = registry?.[`${kind}s`] ?? []
  return <div class="modal-scrim" onClick={onClose}>
    <div class="modal" onClick={event => event.stopPropagation()}>
      <h2>New {kind}</h2>
      <div class="form" style={{ padding: 0 }}>
        <div class="field"><label>Title</label><input type="text" value={title} autofocus onInput={e => { setTitle(e.currentTarget.value); if (!initial?.id) setId(e.currentTarget.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/^[^a-z]+/, '')) }} /></div>
        <div class="field"><label>Id <span class="hint">folder name in extensions/</span></label><input type="text" value={id} onInput={e => setId(e.currentTarget.value)} />{id && !ID_RE.test(id) && <span class="error">Use lowercase letters, digits and hyphens, starting with a letter</span>}{taken && <span class="error">That id is already in use</span>}</div>
        <div class="field"><label>Start from</label><select value={from} onChange={e => setFrom(e.currentTarget.value)}><option value="">Blank</option>{options.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div>
        <div class="row" style={{ display: 'flex', gap: '8px' }}>
          <button class="btn is-primary" disabled={!valid} onClick={() => onCreate({ kind, id, title: title.trim(), from: from || null })}>Create</button>
          <button class="btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  </div>
}
