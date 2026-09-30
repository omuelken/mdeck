import { h } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import './toolbar.css'

// The floating ink toolbar: tools, colours, sizes, undo/redo, clear slide,
// hide saved ink, drawing with a finger, and the ink file. It drives a
// <deck-stage> (inkTool, inkFinger, data-ink-hidden) and an ink controller.

export const INK_COLORS = ['#e11d48', '#2563eb', '#16a34a', '#f59e0b', '#111111', '#ffffff']
const SIZES = { pen: [3, 6, 12], highlighter: [18, 30, 48], marker: [4, 8, 14] }
const TOOLS = [
  ['pen', 'Pen', 'M4 20l4-1 11-11-3-3L5 16zM14 6l3 3'],
  ['highlighter', 'Highlighter', 'M5 19h6M9 15l-3 4M9 15l8-8 3 3-8 8zM15 5l2-2 4 4-2 2'],
  ['marker', 'Marker (fades)', 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6'],
  ['eraser', 'Eraser', 'M8 20h12M5 15l8-8 6 6-6 6H9z'],
]
const ICON = {
  undo: 'M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3',
  redo: 'M15 14l5-5-5-5M20 9H9a5 5 0 000 10h3',
  clear: 'M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  eyeOff: 'M3 3l18 18M10.6 5.1A10 10 0 0112 5c6 0 10 7 10 7a17 17 0 01-3 3.8M6.2 6.2C3.6 8 2 12 2 12s4 7 10 7a9.6 9.6 0 004.3-1',
  finger: 'M9 11V5a2 2 0 014 0v5M13 10V8a2 2 0 014 0v5a7 7 0 01-7 7h-.5A5.5 5.5 0 014 16l-1-3a2 2 0 013.5-1.8L9 14',
  download: 'M12 4v11m0 0l-4-4m4 4l4-4M5 19h14',
  done: 'M5 12l5 5 9-10',
}
const Icon = ({ d }) => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={d} /></svg>

export function InkToolbar({ stage, controller, onDone }) {
  const [tool, setTool] = useState(stage.inkTool?.tool ?? 'pen')
  const [color, setColor] = useState(stage.inkTool?.color ?? INK_COLORS[0])
  const [sizeIndex, setSizeIndex] = useState(1)
  const [hidden, setHidden] = useState(stage.hasAttribute('data-ink-hidden'))
  const [finger, setFinger] = useState(!!stage.inkFinger)
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
    <button type="button" class={`ink-btn${active ? ' is-active' : ''}`} title={label} aria-label={label} aria-pressed={active} disabled={disabled} onClick={action}><Icon d={icon} /></button>

  return <div class="ink-toolbar" role="toolbar" aria-label="Ink">
    <div class="ink-group">
      {TOOLS.map(([id, label, icon]) => button(label, icon, () => setTool(id), { active: tool === id }))}
    </div>
    <div class="ink-group">
      {INK_COLORS.map(value => <button type="button" key={value} class={`ink-color${value === color ? ' is-active' : ''}`} style={{ '--swatch': value }} title={value} aria-label={`Colour ${value}`} aria-pressed={value === color} onClick={() => { setColor(value); if (tool === 'eraser') setTool('pen') }} />)}
    </div>
    <div class="ink-group">
      {[0, 1, 2].map(i => <button type="button" key={i} class={`ink-size${i === sizeIndex ? ' is-active' : ''}`} title={['Thin', 'Medium', 'Thick'][i]} aria-label={['Thin', 'Medium', 'Thick'][i]} aria-pressed={i === sizeIndex} onClick={() => setSizeIndex(i)}><span style={{ width: `${6 + i * 5}px`, height: `${6 + i * 5}px` }} /></button>)}
    </div>
    <div class="ink-group">
      {button('Undo', ICON.undo, () => controller.undo(), { disabled: !history.canUndo })}
      {button('Redo', ICON.redo, () => controller.redo(), { disabled: !history.canRedo })}
      {button('Clear this slide', ICON.clear, () => { const id = slideId(); if (id && confirm('Remove all drawings on this slide?')) controller.clearSlide(id) })}
    </div>
    <div class="ink-group">
      {button(hidden ? 'Show saved ink' : 'Hide saved ink', hidden ? ICON.eyeOff : ICON.eye, () => setHidden(!hidden), { active: hidden })}
      {button(finger ? 'Fingers draw (on)' : 'Fingers draw (off: only the pen draws once used)', ICON.finger, () => setFinger(!finger), { active: finger })}
      {!history.saving && button(history.unsaved ? 'Download the ink file (changes are only in this browser)' : 'Download the ink file', ICON.download, () => controller.download(), { active: history.unsaved })}
    </div>
    <div class="ink-group">
      {button('Done drawing (D)', ICON.done, onDone)}
    </div>
  </div>
}
