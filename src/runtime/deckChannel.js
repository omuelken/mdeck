// How the presenter view reaches its frames and the audience window.

// One address parameter selects the view: ?view=deck, reader, presenter, audience or follow.
export function requestedView(url, fallback = 'deck') {
  return url.searchParams.get('view') ?? fallback
}

// Scope controls to this file and presenter session, including separate tabs.
export const controlUrl = new URL(window.location.href)
if (requestedView(controlUrl) === 'presenter' && !controlUrl.searchParams.has('session')) {
  // randomUUID only exists on https or localhost, not on an iPad at http://192.168…
  controlUrl.searchParams.set('session', crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join(''))
  history.replaceState(null, '', controlUrl)
}
export const DECK_CHANNEL = `deck-control:${controlUrl.pathname}:${controlUrl.searchParams.get('session') ?? 'default'}`

export function sendTo(win, command, value) {
  if (!win || win.closed) return
  win.postMessage({ deckControl: { command, value } }, '*')
}
