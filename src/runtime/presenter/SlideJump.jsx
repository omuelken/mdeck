import { h } from 'preact'
import { useRef, useState } from 'preact/hooks'
import { S } from '../chrome.jsx'

// The slide number as a field: type a number and press Enter (Go on an
// iPad's keyboard) to jump there. Escape, or leaving it empty, keeps the slide.
export function SlideJump({ index, total, onJump, pad = 0, style }) {
  const [draft, setDraftState] = useState(null)
  // Blur follows Enter and Escape before a re-render, so it reads the ref.
  const draftRef = useRef(null)
  const setDraft = value => { draftRef.current = value; setDraftState(value) }
  const shown = draft ?? String(index + 1).padStart(pad, '0')
  function commit() {
    const n = Number.parseInt(draftRef.current ?? '', 10)
    setDraft(null)
    if (Number.isInteger(n) && n - 1 !== index) onJump(Math.max(1, Math.min(total, n)) - 1)
  }
  return (
    <form class="presenter-jump" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', margin: 0, ...style }}
      onSubmit={e => { e.preventDefault(); commit(); e.currentTarget.elements.slide.blur() }}>
      <input
        name="slide" type="text" inputMode="numeric" pattern="[0-9]*" enterKeyHint="go" autoComplete="off"
        title="Go to slide: type its number and press Enter" aria-label={`Slide number, 1 to ${total}`}
        value={shown}
        size={Math.max(2, String(total).length)}
        onFocus={e => e.currentTarget.select()}
        onInput={e => setDraft(e.currentTarget.value.replace(/\D/g, ''))}
        onKeyDown={e => {
          if (e.key !== 'Escape') return
          setDraft(null)
          // Typing and Escape can land in one render, which then changes nothing.
          e.currentTarget.value = String(index + 1).padStart(pad, '0')
          e.currentTarget.blur()
        }}
        onBlur={() => { if (draftRef.current !== null) commit() }}
        style={{ ...S.btn, cursor: 'text', padding: '2px 4px', width: `${Math.max(2, String(total).length) + 1.5}ch`, textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: 'inherit' }}
      />
      <span>/ {String(total).padStart(pad, '0')}</span>
    </form>
  )
}
