import { h } from 'preact'
import { useEffect, useState } from 'preact/hooks'

const normalize = text => String(text ?? '').replace(/\r?\n/g, '\n').trim()

// A textarea whose value derives from the deck source. It keeps a local
// draft so trimming and newline normalization never move the caret, and only
// resyncs when the model really differs from what is being typed.
export function TextArea({ value, onInput, rows = 4, tall = false, ...rest }) {
  const [draft, setDraft] = useState(value ?? '')
  useEffect(() => { if (normalize(value) !== normalize(draft)) setDraft(value ?? '') }, [value])
  // Grow with the text so nothing has to be scrolled inside a small box.
  const lines = draft.split('\n').length + 1
  return <textarea rows={tall ? rows : Math.min(40, Math.max(rows, lines))} class={tall ? 'is-tall' : ''} value={draft} spellcheck={false}
    onInput={event => { setDraft(event.currentTarget.value); onInput(event.currentTarget.value) }} {...rest} />
}

// A number box that writes to the deck when the typing is done (Enter or
// leaving the box), not after each digit; a draft keeps what is typed.
export function NumberInput({ value, onChange, ...rest }) {
  const [draft, setDraft] = useState(value == null ? '' : String(value))
  useEffect(() => { setDraft(value == null ? '' : String(value)) }, [value])
  const commit = () => { if (draft !== (value == null ? '' : String(value))) onChange(draft) }
  return <input type="number" value={draft} onInput={event => setDraft(event.currentTarget.value)} onChange={commit}
    onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} {...rest} />
}

export function Field({ label, required, hint, error, children }) {
  return <div class="field">
    {label && <label>{label}{required && <span class="req">required</span>}{hint && <span class="hint">{hint}</span>}</label>}
    {children}
    {error && <span class="error">{error}</span>}
  </div>
}
