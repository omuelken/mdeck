// The talk across devices, through the deck's stage room on the room server
// (built into `mdeck run`, or `mdeck live`): an iPad draws and steers, the
// laptop's audience window on the projector follows.
//
// The presenter's windows only send: live ink in batches (the bus.js
// messages) and their position as the room's state. Only audience windows
// hold a connection to listen, since browsers allow few per server.
import { stageRoom } from '../../live/client.js'

const BATCH_MS = 80

/** An ink bus transport through the stage room; `listen` only when `receive`. */
export function roomTransport({ receive = false } = {}) {
  const room = stageRoom()
  let queue = [], timer = null, allowed = null, listeners = 1, source = null

  async function flush() {
    timer = null
    if (!queue.length) return
    const messages = queue.splice(0, 100)
    if (allowed === null) {
      const info = await room.info()
      allowed = info.reachable ? !!info.canReset : null
      if (!allowed) { queue = []; return }
    }
    try {
      const response = await fetch(`${room.url}/ink`, { method: 'POST', headers: room.headers({ 'Content-Type': 'application/json' }), body: JSON.stringify({ messages }) })
      if (response.status === 403) { allowed = false; queue = []; return }
      if (response.ok) listeners = (await response.json()).listeners ?? 1
    } catch {}
    if (queue.length) timer = setTimeout(flush, BATCH_MS)
  }

  return {
    send(message) {
      if (allowed === false) return
      // Nobody on another device watches: strokes in progress can stay here.
      if (message.type === 'segment' && listeners === 0) return
      queue.push(message)
      timer ??= setTimeout(flush, message.type === 'segment' ? BATCH_MS : 0)
    },
    listen(handler) {
      if (!receive || typeof EventSource === 'undefined') return
      source = new EventSource(`${room.url}/events`)
      source.addEventListener('snapshot', event => { for (const message of JSON.parse(event.data).ink ?? []) handler(message) })
      source.addEventListener('ink', event => { for (const message of JSON.parse(event.data).messages) handler(message) })
      for (const listener of stateListeners) source.addEventListener('snapshot', event => listener(JSON.parse(event.data).state))
      for (const listener of stateListeners) source.addEventListener('state', event => listener(JSON.parse(event.data).state))
    },
    close() { source?.close() },
  }
}

// Position followers, attached before the transport listens.
const stateListeners = new Set()

/** The audience window: goes where the presenter on another device goes. */
export function followStageRoom(stage) {
  stateListeners.add(state => {
    if (!state || state.screen === stageRoom().screen || !Number.isInteger(state.index)) return
    const current = stage.state
    if (current?.index === state.index && current?.step === state.step) return
    stage.setState({ index: state.index, step: state.step ?? -1, slideId: state.slideId })
  })
}

/** The presenter's windows: tell the stage room where the talk is. */
export function announceStagePosition(stage) {
  const room = stageRoom()
  let allowed = null, last = null, first = true
  async function post() {
    const { index, step, slideId } = stage.state
    const key = `${index}:${step}`
    if (key === last || allowed === false) return
    // Opening a window must not move the projector; only changes count.
    const at = first ? 0 : Date.now()
    first = false
    last = key
    if (allowed === null) {
      const info = await room.info()
      allowed = info.reachable && !!info.canReset
      if (!allowed) return
    }
    fetch(`${room.url}/state`, { method: 'POST', headers: room.headers({ 'Content-Type': 'application/json' }), body: JSON.stringify({ state: { index, step, slideId, at, screen: room.screen } }) }).catch(() => {})
  }
  stage.addEventListener('statechange', post)
  post()
}
