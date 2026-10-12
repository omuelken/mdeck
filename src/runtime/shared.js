// State that deck components share across slides and across the windows of
// one talk: the presenter's slide frame, the audience window, other deck
// windows in this browser, and a paired iPad. Components reach it through
// `mdeck/component` (component.js). Values travel on the ink bus (ink/bus.js)
// as `shared` messages; nothing is saved, and a window that opens later asks
// the others for what they hold (`shared-ask`). A deck whose components use
// none of it sends nothing.
//
// The latest change wins as it arrives. A value replayed for a window that
// opened later only fills a name that window does not know yet, so no clocks
// are compared between devices.

const values = new Map()
const listeners = new Map()
let send = null
let asked = false
let view = 'deck'

// Windows that only show the talk read shared state but do not change it.
const READ_ONLY = new Set(['preview', 'reader', 'follow'])

/** The kind of window this is: presenter, audience, deck, follow, preview or reader. */
export function setView(next) { view = next }
export function currentView() { return view }

function notify(name) {
  for (const listener of listeners.get(name) ?? []) listener(values.get(name))
}

// Asks the others once, when this window has both a bus and a component
// that uses shared state.
function ask() {
  if (asked || !send || !listeners.size) return
  asked = true
  send({ type: 'shared-ask' })
}

/** The bus this window sends on. */
export function connectShared(sender) {
  send = sender
  ask()
}

/** A `shared` or `shared-ask` message from another window. */
export function receiveShared(message) {
  if (message.type === 'shared-ask') {
    for (const [name, value] of values) send?.({ type: 'shared', name, value, replay: true })
    return
  }
  if (typeof message.name !== 'string') return
  if (message.replay && values.has(message.name)) return
  values.set(message.name, message.value)
  notify(message.name)
}

export function getShared(name) { return values.get(name) }

/** Sets a value here and in every other window; ignored where the talk is only shown. */
export function setShared(name, value) {
  if (READ_ONLY.has(view)) return false
  // Only what survives JSON reaches the other windows; keep this one the same.
  const plain = value === undefined ? null : JSON.parse(JSON.stringify(value))
  values.set(name, plain)
  notify(name)
  send?.({ type: 'shared', name, value: plain })
  return true
}

export function subscribeShared(name, listener) {
  if (!listeners.has(name)) listeners.set(name, new Set())
  listeners.get(name).add(listener)
  ask()
  return () => listeners.get(name)?.delete(listener)
}

/** For tests: forget everything. */
export function resetShared() { values.clear(); listeners.clear(); send = null; asked = false; view = 'deck' }
