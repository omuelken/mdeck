import { h } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { Icon } from '../../components/Icon.jsx'
import { inkPaint } from '../../core/ink.js'
import './toolbar.css'

// The floating ink toolbar: tools, colours and sizes of the pen and the
// highlighter (each keeps its own; one pen colour is the theme's accent),
// deleting a selection, undo/redo, clear slide, hide saved ink, drawing with a
// finger, and the drawings file. Swipes and the deck's own controls and keys
// turn the slides. It folds into one button in the bottom right corner,
// showing the current tool, and drawing goes on while it is folded. It drives
// a <deck-stage> (inkTool, inkFinger, data-ink-hidden), an ink controller and
// the selection.

// "accent" is stored as the word and drawn in the theme's --accent, so the
// drawing follows the palette (inkPaint in core/ink.js).
export const INK_COLORS = ['#e11d48', '#2563eb', '#16a34a', 'accent', '#111111']
export const HIGHLIGHTER_COLORS = ['#ffeb3b', '#76ff03', '#ff4081', '#40c4ff', '#ff9100']
const COLORS = { pen: INK_COLORS, highlighter: HIGHLIGHTER_COLORS }
const COLOR_NAMES = { '#e11d48': 'Red', '#2563eb': 'Blue', '#16a34a': 'Green', accent: 'Accent', '#111111': 'Text colour',
  '#ffeb3b': 'Yellow', '#76ff03': 'Green', '#ff4081': 'Pink', '#40c4ff': 'Blue', '#ff9100': 'Orange' }
const SIZES = { pen: [3, 6, 12], highlighter: [18, 30, 48] }
// Each tool's icon has the tool's name.
const TOOLS = [
  ['pen', 'Pen'],
  ['highlighter', 'Highlighter'],
  ['select', 'Select and move'],
  ['laser', 'Laser pointer'],
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

export function InkToolbar({ stage, controller, selection, onDone }) {
  const [tool, setTool] = useState(TOOLS.some(([id]) => id === stage.inkTool?.tool) ? stage.inkTool.tool : 'pen')
  const [style, setStyle] = useState(() => ({ pen: { color: INK_COLORS[0], sizeIndex: 1 }, highlighter: { color: HIGHLIGHTER_COLORS[0], sizeIndex: 1 }, ...stage._inkStyle }))
  const [selected, setSelected] = useState(0)
  const [collapsed, setCollapsed] = useState(!!stage._inkCollapsed)
  const [hidden, setHidden] = useState(stage.hasAttribute('data-ink-hidden'))
  const [finger, setFinger] = useState(!!stage.inkFinger)
  const [clearing, setClearing] = useState(null) // the slide id awaiting confirmation
  const [history, setHistory] = useState({ canUndo: false, canRedo: false, unsaved: false })

  useEffect(() => controller.subscribe(setHistory), [controller])
  useEffect(() => selection?.subscribe(setSelected), [selection])
  useEffect(() => {
    const { color, sizeIndex } = style[tool] ?? style.pen
    stage.inkTool = { tool, color, size: (SIZES[tool] ?? SIZES.pen)[sizeIndex] }
    // Remembered while the page is open, when drawing starts again.
    stage._inkStyle = style
    stage.setAttribute('data-ink-tool', tool)
    if (tool !== 'select') selection?.clear()
  }, [tool, style])
  const setOwn = change => setStyle(all => ({ ...all, [tool]: { ...all[tool], ...change } }))
  useEffect(() => { stage._inkCollapsed = collapsed }, [collapsed])
  useEffect(() => { stage.toggleAttribute('data-ink-hidden', hidden) }, [hidden])
  useEffect(() => { stage.inkFinger = finger }, [finger])

  const slideId = () => stage._inkSlideId?.()
  const button = (label, icon, action, { active = false, disabled = false } = {}) =>
    <button type="button" class={`ink-btn${active ? ' is-active' : ''}`} title={label} aria-label={label} aria-pressed={active} disabled={disabled} onClick={action}><Icon name={icon} size={20} /></button>

  const writing = !!COLORS[tool]
  if (collapsed) {
    const [, label] = TOOLS.find(([id]) => id === tool)
    return <div class="ink-toolbar is-collapsed" role="toolbar" aria-label="Ink" data-ink-ui>
      <button type="button" class="ink-btn ink-expand" title={`${label}: show the toolbar`} aria-label={`${label}: show the toolbar`} style={writing ? { '--tool-color': inkPaint(style[tool].color) } : {}} onClick={() => setCollapsed(false)}><Icon name={tool} size={20} /></button>
    </div>
  }
  return <div class="ink-toolbar" role="toolbar" aria-label="Ink" data-ink-ui>
    <div class="ink-group">
      {TOOLS.map(([id, label]) => button(label, id, () => setTool(id), { active: tool === id }))}
    </div>
    {writing && <div class="ink-group">
      {COLORS[tool].map(value => <button type="button" key={value} class={`ink-color${value === style[tool].color ? ' is-active' : ''}`} style={{ '--swatch': inkPaint(value) }} title={COLOR_NAMES[value] ?? value} aria-label={`Colour ${COLOR_NAMES[value] ?? value}`} aria-pressed={value === style[tool].color} onClick={() => setOwn({ color: value })} />)}
    </div>}
    {writing && <div class="ink-group">
      {[0, 1, 2].map(i => <button type="button" key={i} class={`ink-size${i === style[tool].sizeIndex ? ' is-active' : ''}`} title={['Thin', 'Medium', 'Thick'][i]} aria-label={['Thin', 'Medium', 'Thick'][i]} aria-pressed={i === style[tool].sizeIndex} onClick={() => setOwn({ sizeIndex: i })}><span style={{ width: `${6 + i * 5}px`, height: `${6 + i * 5}px` }} /></button>)}
    </div>}
    {selected > 0 && <div class="ink-group">
      {button('Delete selection (Delete)', 'trash', () => selection.remove())}
    </div>}
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
      {button(finger ? 'Fingers draw (on)' : 'Fingers draw (off: fingers swipe and select)', 'finger', () => setFinger(!finger), { active: finger })}
      {!history.saving && button(history.unsaved ? 'Download the drawings file (changes are only in this browser)' : 'Download the drawings file', 'download', () => controller.download(), { active: history.unsaved })}
    </div>
    <div class="ink-group">
      {button('Fold the toolbar', 'fold', () => setCollapsed(true))}
      {button('Stop drawing (D)', 'close', onDone)}
    </div>
  </div>
}
