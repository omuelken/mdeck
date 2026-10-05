import { h } from 'preact'
import { useEffect } from 'preact/hooks'

export function LayoutPicker({ layouts, onPick, onClose }) {
  useEffect(() => {
    const onKey = event => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return <div class="modal-scrim" onClick={onClose}>
    <div class="modal" onClick={event => event.stopPropagation()}>
      <h2>Add a slide</h2>
      <ul class="picker">
        {Object.values(layouts).map(item => <li key={item.id}>
          <button class="btn" onClick={() => onPick(item)}>
            <strong>{item.title}</strong>
            {item.description && <small>{item.description}</small>}
          </button>
        </li>)}
      </ul>
    </div>
  </div>
}
