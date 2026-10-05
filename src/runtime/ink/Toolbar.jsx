import { h } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { Icon } from '../../components/Icon.jsx'
import './toolbar.css'

// The floating ink toolbar: previous/next (so a lone iPad can present while
// drawing), tools, colours, sizes, undo/redo, clear slide,
// hide saved ink, drawing with a finger, and the ink file. It drives a
// <deck-stage> (inkTool, inkFinger, data-ink-hidden) and an ink controller.

export const INK_COLORS = ['#e11d48', '#2563eb', '#16a34a', '#f59e0b', '#111111', '#ffffff']
const COLOR_NAMES = { '#e11d48': 'Red', '#2563eb': 'Blue', '#16a34a': 'Green', '#f59e0b': 'Amber', '#111111': 'Black', '#ffffff': 'White' }
const SIZES = { pen: [3, 6, 12], highlighter: [18, 30, 48], marker: [4, 8, 14] }
// Each tool's icon has the tool's name.
const TOOLS = [
  ['pen', 'Pen'],
  ['highlighter', 'Highlighter'],
  ['marker', 'Marker (fades)'],
  ['eraser', 'Eraser'],
]

// A small "are you sure" popover above the button that opened it. It does not
// dim anything. While open it takes the keys, so the deck behind it does not
// turn slides; Escape or a tap elsewhere cancels, and focus stays inside.
function ConfirmPopover({ message, confirmLabel, onConfirm, onCancel }) {
  const cancelRef = useRef(null)
  const popRef = useRef(null)
  useEffect(() => {
    const pop = popRef.current
    // Keep it on screen when the button sits near an edge of a narrow window.
    const rect = pop.getBoundingClientRect()
    const shift = Math.max(8 - rect.left, Math.min(0, innerWidth - 8 - rect.right))
    pop.style.setProperty('--shift', `${Math.round(shift)}px`)
    const opener = document.activeElement
    cancelRef.current?.focus()
    const onKey = event => {
      event.stopPropagation()
      if (event.key === 'Escape') { event.preventDefault(); onCancel() }
      else if (event.key === 'Tab') {
        const items = [...pop.querySelectorAll('button')]
        const at = items.indexOf(document.activeElement)
        event.preventDefault()
        items[(at + (event.shiftKey ? items.length - 1 : 1)) % items.length].focus()
      }
    }
    const onDown = event => { if (!pop.parentElement.contains(event.target)) onCancel() }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('pointerdown', onDown, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('pointerdown', onDown, true)
      opener?.focus?.()
    }
  }, [])
  return <div class="ink-pop" ref={popRef} role="alertdialog" aria-label={message}>
    <span class="ink-pop-text">{message}</span>
    <button type="button" class="ink-pop-btn" ref={cancelRef} onClick={onCancel}>Cancel</button>
    <button type="button" class="ink-pop-btn is-danger" onClick={onConfirm}>{confirmLabel}</button>
  </div>
}

export function InkToolbar({ stage, controller, onDone }) {
  const [tool, setTool] = useState(stage.inkTool?.tool ?? 'pen')
  const [color, setColor] = useState(stage.inkTool?.color ?? INK_COLORS[0])
  const [sizeIndex, setSizeIndex] = useState(1)
  const [hidden, setHidden] = useState(stage.hasAttribute('data-ink-hidden'))
  const [finger, setFinger] = useState(!!stage.inkFinger)
  const [clearing, setClearing] = useState(null) // the slide id awaiting confirmation
  const [history, setHistory] = useState({ canUndo: false, canRedo: false, unsaved: false })

  useEffect(() => controller.subscribe(setHistory), [controller])
  useEffect(() => {
    const size = (SIZES[tool] ?? SIZES.pen)[sizeIndex]
    stage.inkTool = { tool, color, size }
    stage.setAttribute('data-ink-tool', tool)
  }, [tool, color, sizeIndex])
  useEffect(() => { stage.toggleAttribute('data-ink-hidden', hidden) }, [hidden])
  useEffect(() => { stage.inkFinger = finger }, [finger])

  const slideId = () => stage._inkSlideId?.()
  const button = (label, icon, action, { active = false, disabled = false } = {}) =>
    <button type="button" class={`ink-btn${active ? ' is-active' : ''}`} title={label} aria-label={label} aria-pressed={active} disabled={disabled} onClick={action}><Icon name={icon} size={20} /></button>

  return <div class="ink-toolbar" role="toolbar" aria-label="Ink">
    <div class="ink-group">
      {button('Previous', 'prev', () => stage.prev('click'))}
      {button('Next', 'next', () => stage.next('click'))}
    </div>
    <div class="ink-group">
      {TOOLS.map(([id, label]) => button(label, id, () => setTool(id), { active: tool === id }))}
    </div>
    <div class="ink-group">
      {INK_COLORS.map(value => <button type="button" key={value} class={`ink-color${value === color ? ' is-active' : ''}`} style={{ '--swatch': value }} title={COLOR_NAMES[value] ?? value} aria-label={`Colour ${COLOR_NAMES[value] ?? value}`} aria-pressed={value === color} onClick={() => { setColor(value); if (tool === 'eraser') setTool('pen') }} />)}
    </div>
    <div class="ink-group">
      {[0, 1, 2].map(i => <button type="button" key={i} class={`ink-size${i === sizeIndex ? ' is-active' : ''}`} title={['Thin', 'Medium', 'Thick'][i]} aria-label={['Thin', 'Medium', 'Thick'][i]} aria-pressed={i === sizeIndex} onClick={() => setSizeIndex(i)}><span style={{ width: `${6 + i * 5}px`, height: `${6 + i * 5}px` }} /></button>)}
    </div>
    <div class="ink-group">
      {button('Undo', 'undo', () => controller.undo(), { disabled: !history.canUndo })}
      {button('Redo', 'redo', () => controller.redo(), { disabled: !history.canRedo })}
      <span class="ink-anchor">
        {button('Clear this slide', 'trash', () => { const id = slideId(); setClearing(open => open || !id ? null : id) })}
        {clearing && <ConfirmPopover
          message="Clear this slide?"
          confirmLabel="Clear"
          onCancel={() => setClearing(null)}
          onConfirm={() => { controller.clearSlide(clearing); setClearing(null) }}
        />}
      </span>
    </div>
    <div class="ink-group">
      {button(hidden ? 'Show saved ink' : 'Hide saved ink', hidden ? 'eye-off' : 'eye', () => setHidden(!hidden), { active: hidden })}
      {button(finger ? 'Fingers draw (on)' : 'Fingers draw (off: only the pen draws once used)', 'finger', () => setFinger(!finger), { active: finger })}
      {!history.saving && button(history.unsaved ? 'Download the drawings file (changes are only in this browser)' : 'Download the drawings file', 'download', () => controller.download(), { active: history.unsaved })}
    </div>
    <div class="ink-group">
      {button('Done drawing (D)', 'check', onDone)}
    </div>
  </div>
}
