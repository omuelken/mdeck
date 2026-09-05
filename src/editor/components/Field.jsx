import { h } from 'preact'
import { useEffect, useState } from 'preact/hooks'

const normalize = text => String(text ?? '').replace(/\r?\n/g, '\n').trim()

// A textarea whose value derives from the deck source. It keeps a local
// draft so trimming and newline normalization never move the caret, and only
// resyncs when the model really differs from what is being typed.
export function TextArea({ value, onInput, rows = 4, tall = false, ...rest }) {
  const [draft, setDraft] = useState(value ?? '')
  useEffect(() => { if (normalize(value) !== normalize(draft)) setDraft(value ?? '') }, [value])
  return <textarea rows={rows} class={tall ? 'is-tall' : ''} value={draft} spellcheck={false}
    onInput={event => { setDraft(event.currentTarget.value); onInput(event.currentTarget.value) }} {...rest} />
}

export function Field({ label, required, hint, error, children }) {
  return <div class="field">
    {label && <label>{label}{required && <span class="req">required</span>}{hint && <span class="hint">{hint}</span>}</label>}
    {children}
    {error && <span class="error">{error}</span>}
  </div>
}
