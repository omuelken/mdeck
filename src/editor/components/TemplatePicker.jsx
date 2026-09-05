import { h } from 'preact'
import { useEffect } from 'preact/hooks'

export function TemplatePicker({ templates, onPick, onClose }) {
  useEffect(() => {
    const onKey = event => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return <div class="modal-scrim" onClick={onClose}>
    <div class="modal" onClick={event => event.stopPropagation()}>
      <h2>Add a slide</h2>
      <ul class="picker">
        {Object.values(templates).map(template => <li key={template.id}>
          <button class="btn" onClick={() => onPick(template)}>
            <strong>{template.title}</strong>
            {template.description && <small>{template.description}</small>}
          </button>
        </li>)}
      </ul>
    </div>
  </div>
}
