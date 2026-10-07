import { h } from 'preact'
import { useState } from 'preact/hooks'
import { parseManifest, toModel, toToml, MANIFEST } from '../extensions.js'
import { PaletteForm, ThemeForm } from './ExtensionForms.jsx'
import { Diagnostics } from './Diagnostics.jsx'
import { Field, TextArea } from './Field.jsx'
import { Swatches } from './PalettePicker.jsx'

const KIND_LABEL = { palette: 'Palette', theme: 'Theme' }

// Edits one of the deck's own extensions. `files` is the source of truth; the
// form derives its model from extension.toml and writes TOML back.
export function ExtensionEditor({ extension, palettes = {}, status, error, note, onFiles, onDelete, onCopy }) {
  const [mode, setMode] = useState('form')
  const [confirm, setConfirm] = useState(false)
  const { kind, id, files } = extension
  const parsed = parseManifest(files[MANIFEST] ?? '')
  const model = parsed.raw ? toModel({ ...parsed.raw, kind }) : null
  const change = patch => onFiles({ [MANIFEST]: toToml({ ...model, ...patch }) })
  const file = (name, text) => onFiles({ [name]: text })
  const problems = [
    ...(parsed.error ? [{ severity: 'error', message: parsed.error, line: parsed.line }] : []),
    ...(error ? [{ severity: 'error', message: error, code: 'save' }] : []),
  ]
  return <>
    <div class="tabs">
      <button class={mode === 'form' ? 'is-active' : ''} onClick={() => setMode('form')}>{KIND_LABEL[kind]}</button>
      <button class={mode === 'raw' ? 'is-active' : ''} onClick={() => setMode('raw')}>extension.toml</button>
      <span style={{ flex: 1 }} />
      <span class={`editor-status is-${status}`} style={{ alignSelf: 'center' }}>{{ saved: 'Saved', unsaved: 'Unsaved', saving: 'Saving…', error: 'Not saved' }[status]}</span>
    </div>
    <div class="form">
      <Diagnostics items={problems} />
      {note && <p class="note">{note}</p>}
      {mode === 'raw' || !model
        ? <Field label="extension.toml"><TextArea tall rows={24} value={files[MANIFEST] ?? ''} onInput={text => file(MANIFEST, text)} /></Field>
        : kind === 'palette' ? <PaletteForm model={model} onChange={change} />
        : <ThemeForm model={model} files={files} palettes={palettes} onChange={change} onFile={file} />}
      <div class="row" style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        {confirm
          ? <><span style={{ color: '#f28b82' }}>Delete the folder extensions/{id}?</span><button class="btn is-small" onClick={onDelete}>Yes, delete</button><button class="btn is-small" onClick={() => setConfirm(false)}>Keep</button></>
          : <><button class="btn is-small" onClick={onCopy}>Make a copy</button><button class="btn is-small" onClick={() => setConfirm(true)}>Delete this {kind}</button></>}
      </div>
    </div>
  </>
}

// A built-in or installed theme or palette: what it is, the one way to
// change it (a copy in the deck's extensions folder), and removing it.
export function BuiltInCard({ extension, manifest, onCopy, onRemove }) {
  const { kind, id, files } = extension
  const user = extension.source === 'user'
  const [removing, setRemoving] = useState(null)
  return <div class="form">
    <p class="section-title">{user ? `Installed for every deck` : `Comes with mdeck`}{manifest?.version ? ` · ${manifest.version}` : ''}</p>
    <h2 class="builtin-title">{manifest?.title ?? id} <span class="muted">{id}</span></h2>
    {manifest?.description && <p class="builtin-description">{manifest.description}</p>}
    {kind === 'palette' && manifest && ['light', 'dark'].map(mode => <Field key={mode} label={mode === 'light' ? 'Light' : 'Dark'}><Swatches tokens={manifest[mode] ?? {}} /></Field>)}
    {kind === 'theme' && manifest?.palette && <p class="builtin-description">Its default palette is <code>{manifest.palette}</code>{manifest.palettes?.length ? `; it offers only ${manifest.palettes.join(', ')}` : ''}.</p>}
    <p class="note">{user ? `Installed ${kind}s change only when they are updated (mdeck ${kind}s update).` : `This ${kind} cannot be changed where it is.`} Copy this one into the deck's <code>extensions</code> folder and change the copy. The preview shows every change as you make it.</p>
    <div class="row" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      <button class="btn is-primary" onClick={onCopy}>Copy to customise</button>
      {onRemove && (removing === 'confirm'
        ? <><span class="muted" style={{ alignSelf: 'center' }}>Remove the {kind} {id} for every deck?</span>
          <button class="btn" onClick={async () => { setRemoving('busy'); try { await onRemove(kind, id); setRemoving(null) } catch (error) { setRemoving({ error: error.message }) } }}>Remove</button>
          <button class="btn" onClick={() => setRemoving(null)}>Keep</button></>
        : <button class="btn" disabled={removing === 'busy'} onClick={() => setRemoving('confirm')}>Remove {kind}</button>)}
    </div>
    {removing?.error && <p class="online-error">{removing.error}</p>}
    {!user && <p class="hint-text">Removing a {kind} that comes with mdeck hides it; install it again from “More to install”.</p>}
    <details class="builtin-source">
      <summary>{MANIFEST}</summary>
      <pre>{files?.[MANIFEST] ?? ''}</pre>
    </details>
  </div>
}
