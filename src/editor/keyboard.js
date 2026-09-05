const EDITABLE = 'input, textarea, select, [contenteditable]'

// Undo and redo work everywhere (textarea values derive from the source, so
// native undo would fight the model). Navigation and structure shortcuts stay
// out of text fields.
export function installShortcuts(handlers, target = window) {
  const onKey = event => {
    const mod = event.metaKey || event.ctrlKey
    const key = event.key.toLowerCase()
    if (mod && key === 'z') { event.preventDefault(); return event.shiftKey ? handlers.redo?.() : handlers.undo?.() }
    if (mod && key === 'y') { event.preventDefault(); return handlers.redo?.() }
    if (event.target?.closest?.(EDITABLE)) return
    if (mod && key === 'enter') { event.preventDefault(); return handlers.add?.() }
    if (mod && key === 'backspace') { event.preventDefault(); return handlers.remove?.() }
    if (mod) return
    if (key === 'arrowup' || key === 'arrowleft' || key === 'pageup') { event.preventDefault(); return handlers.prev?.() }
    if (key === 'arrowdown' || key === 'arrowright' || key === 'pagedown') { event.preventDefault(); return handlers.next?.() }
  }
  target.addEventListener('keydown', onKey)
  return () => target.removeEventListener('keydown', onKey)
}
