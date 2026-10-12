// What live ink does while the network is gone (room.js): it waits longer
// after each failed attempt, and the messages it holds stay few. Segments
// and finished strokes must all arrive, or the others keep a gap; the
// laser's dot and the zoom only say where they are now, so the last of each
// is enough.

const RETRY_MIN_MS = 250
const RETRY_MAX_MS = 5000
// Past this many held messages the oldest strokes in progress go first: a
// stroke drawn long ago in a dead WLAN is not worth a flood when it returns.
export const OUTBOX_LIMIT = 2000

// The wait before the next attempt after `failures` failed ones in a row.
export function retryDelay(failures) {
  return failures ? Math.min(RETRY_MAX_MS, RETRY_MIN_MS * 2 ** (failures - 1)) : 0
}

// The messages worth sending, in their order: only the last dot and zoom of
// each sender, and no more than `limit`, dropping the oldest segments first.
export function compactOutbox(messages, limit = OUTBOX_LIMIT) {
  const last = new Map()
  messages.forEach((message, i) => { if (message.type === 'dot' || message.type === 'zoom') last.set(`${message.type}:${message.key}`, i) })
  let kept = messages.filter((message, i) => !(message.type === 'dot' || message.type === 'zoom') || last.get(`${message.type}:${message.key}`) === i)
  let over = kept.length - limit
  if (over > 0) kept = kept.filter(message => !(message.type === 'segment' && over-- > 0))
  return kept
}
