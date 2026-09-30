// Live ink between the windows of one talk: the presenter's view, the
// audience window, other deck windows. Strokes show while they are drawn,
// and every change of the ink (a finished stroke, the eraser, undo) reaches
// the others right away, whether or not a server saves it.
//
// Messages, the same on every transport:
//   { type: 'segment', key, slideId, tool, color, size, from, points }
//       points `from` index on, every ~60 ms while drawing
//   { type: 'end', key, fade, stroke? }  the stroke is finished; a marker
//       stroke comes whole (it is never saved) and fades
//   { type: 'op', op }                  a change of the saved ink (applyOp)
// Keys start with the sending window's id, so strokes never mix.
import { changeInk } from './store.js'

const SEGMENT_MS = 60

export function broadcastTransport(name) {
  if (typeof BroadcastChannel === 'undefined') return null
  const channel = new BroadcastChannel(name)
  return {
    send: message => channel.postMessage(message),
    listen: handler => { channel.onmessage = ({ data }) => handler(data) },
    close: () => channel.close(),
  }
}

export function createInkBus(stage, transports) {
  transports = transports.filter(Boolean)
  const me = Math.random().toString(36).slice(2, 8)
  const send = message => { for (const transport of transports) transport.send(message) }

  // Strokes from others, by key: the points so far.
  const incoming = new Map()
  function receive(message) {
    if (!message || typeof message !== 'object' || message.key?.startsWith(`${me}:`)) return
    if (message.type === 'op') changeInk(message.op)
    else if (message.type === 'segment') {
      const known = incoming.get(message.key) ?? { ...message, points: [] }
      // A lost segment leaves a gap until the end message repairs it.
      if (message.from <= known.points.length) known.points = [...known.points.slice(0, message.from), ...message.points]
      incoming.set(message.key, known)
      stage.liveStroke(message.key, known)
    } else if (message.type === 'end') {
      if (message.stroke) stage.liveStroke(message.key, message.stroke)
      incoming.delete(message.key)
      stage.endLiveStroke(message.key, { fade: !!message.fade })
    }
  }
  for (const transport of transports) transport.listen(receive)

  // Own strokes in progress, sent in small pieces.
  const outgoing = new Map()
  function flush(key) {
    const entry = outgoing.get(key)
    if (!entry) return
    clearTimeout(entry.timer)
    entry.timer = null
    const { detail, sent } = entry
    if (detail.points.length > sent) {
      send({ type: 'segment', key: `${me}:${key}`, slideId: detail.slideId, tool: detail.tool, color: detail.color, size: detail.size, from: sent, points: detail.points.slice(sent) })
      entry.sent = detail.points.length
    }
  }
  stage.addEventListener('inkprogress', ({ detail }) => {
    let entry = outgoing.get(detail.key)
    if (!entry) outgoing.set(detail.key, entry = { detail, sent: 0, timer: null })
    entry.detail = detail
    entry.timer ??= setTimeout(() => flush(detail.key), entry.sent ? SEGMENT_MS : 0)
  })
  const finish = (detail, extra = {}) => {
    flush(detail.key)
    outgoing.delete(detail.key)
    send({ type: 'end', key: `${me}:${detail.key}`, ...extra })
  }

  return {
    /** A change made in this window: the others apply it too. */
    op(op) { send({ type: 'op', key: `${me}:op`, op }) },
    /** The stroke with this key became saved ink (its op was sent first). */
    strokeDone(detail) { finish(detail) },
    /** A marker stroke ended: the others fade it, like this window. */
    markerDone(detail) { finish(detail, { fade: true, stroke: detail }) },
    close() { for (const transport of transports) transport.close?.() },
  }
}
