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

// A built-in or installed extension: what it is, and the one way to change
// it, a copy in the deck's extensions folder.
export function BuiltInCard({ extension, manifest, onCopy }) {
  const { kind, id, files } = extension
  const user = extension.source === 'user'
  return <div class="form">
    <p class="section-title">{user ? `Installed ${kind}, for every deck` : `Built-in ${kind}`}</p>
    <h2 class="builtin-title">{manifest?.title ?? id} <span class="muted">{id}</span></h2>
    {manifest?.description && <p class="builtin-description">{manifest.description}</p>}
    {kind === 'palette' && manifest && ['light', 'dark'].map(mode => <Field key={mode} label={mode === 'light' ? 'Light' : 'Dark'}><Swatches tokens={manifest[mode] ?? {}} /></Field>)}
    {kind === 'theme' && manifest?.palette && <p class="builtin-description">Its default palette is <code>{manifest.palette}</code>{manifest.palettes?.length ? `; it offers only ${manifest.palettes.join(', ')}` : ''}.</p>}
    <p class="note">{user ? `Installed ${kind}s are changed only by updating them (mdeck themes update --global).` : `Built-in ${kind}s cannot be changed.`} Copy this one into the deck's <code>extensions</code> folder and change the copy. The preview shows every change as you make it.</p>
    <div class="row" style={{ display: 'flex', gap: '8px' }}><button class="btn is-primary" onClick={onCopy}>Copy to customise</button></div>
    <details class="builtin-source">
      <summary>{MANIFEST}</summary>
      <pre>{files?.[MANIFEST] ?? ''}</pre>
    </details>
  </div>
}
