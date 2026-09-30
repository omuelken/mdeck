// Drawing on a deck window: connects a <deck-stage> with an ink controller
// and the floating toolbar. D starts and ends drawing, Escape ends it,
// Cmd/Ctrl+Z undoes and Cmd/Ctrl+Shift+Z redoes.
import { h, render } from 'preact'
import { strokePath } from '../../core/ink.js'
import { createInkController } from './controller.js'
import { InkToolbar } from './Toolbar.jsx'
import { connectInkServer } from './server.js'

const typing = target => target?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]')

export function attachInk(stage, { storageKey, save = null, keys = true } = {}) {
  stage.inkRenderer = strokePath
  const controller = createInkController({ storageKey, save })
  // Saving through `mdeck dev` when it lets this page; otherwise in this browser.
  if (!save) connectInkServer(controller)
  stage.addEventListener('inkstroke', event => controller.addStroke(event.detail))
  stage.addEventListener('inkerase', event => controller.erase(event.detail))

  const host = document.createElement('div')
  host.className = 'ink-toolbar-host'
  document.body.appendChild(host)
  const done = () => { stage.inking = false }
  const showToolbar = on => render(on ? h(InkToolbar, { stage, controller, onDone: done }) : null, host)
  stage.addEventListener('inkmode', event => showToolbar(event.detail.inking))

  if (keys) {
    window.addEventListener('keydown', event => {
      if (typing(event.target)) return
      const mod = event.metaKey || event.ctrlKey
      if (!mod && !event.altKey && (event.key === 'd' || event.key === 'D')) {
        event.preventDefault()
        stage.inking = !stage.inking
      } else if (event.key === 'Escape' && stage.inking) {
        stage.inking = false
      } else if (mod && (event.key === 'z' || event.key === 'Z') && stage.inking) {
        event.preventDefault()
        if (event.shiftKey) controller.redo()
        else controller.undo()
      }
    })
  }
  return controller
}
