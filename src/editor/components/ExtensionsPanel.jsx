import { h } from 'preact'
import { useState } from 'preact/hooks'
import { ID_RE } from '../extensions.js'

const KINDS = [['palette', 'Palettes'], ['theme', 'Themes'], ['template', 'Templates']]

export function ExtensionsPanel({ registry, selected, onSelect, onCreate }) {
  return <aside class="editor-panel">
    {KINDS.map(([kind, label]) => <section key={kind}>
      <div class="editor-panel-head"><span>{label}</span><button class="btn is-small is-primary" onClick={() => onCreate(kind)}>+ New</button></div>
      <ol class="outline-list">
        {(registry?.[`${kind}s`] ?? []).map(item => <li key={item.id} class={`outline-item${selected?.kind === kind && selected?.id === item.id ? ' is-selected' : ''}`} onClick={() => onSelect(kind, item.id)} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
          <span><span class="title" style={{ display: 'block' }}>{item.title}</span><span class="layout">{item.id}{item.source === 'local' ? ' · this deck' : ''}</span></span>
          {item.tokens && <span class="swatches">{['--bg', '--accent', '--ink'].map(key => item.tokens[key] ? <i key={key} style={{ background: item.tokens[key] }} /> : null)}</span>}
        </li>)}
      </ol>
    </section>)}
  </aside>
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
