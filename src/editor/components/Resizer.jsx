import { h } from 'preact'

// Drag handle on the left edge of the inspector column.
export function Resizer({ onResize, min = 320, max = () => window.innerWidth * 0.7 }) {
  const start = event => {
    event.preventDefault()
    const move = e => onResize(Math.max(min, Math.min(max(), window.innerWidth - e.clientX)))
    const stop = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', stop); document.body.style.cursor = '' }
    document.body.style.cursor = 'col-resize'
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', stop)
  }
  return <div class="resizer" onMouseDown={start} title="Drag to resize" />
}

const KEY = 'mdeck-editor-inspector-width'
export function readInspectorWidth() { try { const value = Number(localStorage.getItem(KEY)); return value >= 320 ? value : 400 } catch { return 400 } }
export function storeInspectorWidth(width) { try { localStorage.setItem(KEY, String(width)) } catch {} }
