import { h } from 'preact'
import { useState } from 'preact/hooks'
import { parseManifest, toModel, toToml, MANIFEST } from '../extensions.js'
import { PaletteForm, ThemeForm, TemplateForm } from './ExtensionForms.jsx'
import { Diagnostics } from './Diagnostics.jsx'
import { Field, TextArea } from './Field.jsx'

const KIND_LABEL = { palette: 'Palette', theme: 'Theme', layout: 'Layout' }

// Edits one extension. `files` is the source of truth; the form derives its
// model from extension.toml and writes TOML back.
export function ExtensionEditor({ extension, status, error, note, onFiles, onDelete, onCopy }) {
  const [mode, setMode] = useState('form')
  const [confirm, setConfirm] = useState(false)
  const { kind, id, source, files } = extension
  const readOnly = source !== 'local'
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
      <span class={`editor-status is-${status}`} style={{ alignSelf: 'center' }}>{readOnly ? 'Built in, read only' : { saved: 'Saved', unsaved: 'Unsaved', saving: 'Saving…', error: 'Not saved' }[status]}</span>
    </div>
    <div class="form" style={readOnly ? { opacity: 0.85 } : undefined}>
      <Diagnostics items={problems} />
      {note && <p class="note">{note}</p>}
      {readOnly && <div class="row" style={{ display: 'flex', gap: '8px' }}><button class="btn is-small is-primary" onClick={onCopy}>Copy into this deck to edit</button></div>}
      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, display: 'contents' }}>
        {mode === 'raw' || !model
          ? <Field label="extension.toml"><TextArea tall rows={24} value={files[MANIFEST] ?? ''} onInput={text => file(MANIFEST, text)} /></Field>
          : kind === 'palette' ? <PaletteForm model={model} onChange={change} />
          : kind === 'theme' ? <ThemeForm model={model} files={files} onChange={change} onFile={file} />
          : <TemplateForm model={model} files={files} onChange={change} onFile={file} />}
      </fieldset>
      {!readOnly && <div class="row" style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        {confirm
          ? <><span style={{ color: '#f28b82' }}>Delete the folder extensions/{id}?</span><button class="btn is-small" onClick={onDelete}>Yes, delete</button><button class="btn is-small" onClick={() => setConfirm(false)}>Keep</button></>
          : <button class="btn is-small" onClick={() => setConfirm(true)}>Delete this {kind}</button>}
      </div>}
    </div>
  </>
}
