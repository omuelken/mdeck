// Talks to the editing API served by src/build/editorPlugin.js.
export class ConflictError extends Error {
  constructor({ source, hash }) {
    super('The file changed on disk')
    this.conflict = true
    this.source = source
    this.hash = hash
  }
}

async function failure(response) {
  let message = response.statusText
  try { message = (await response.json()).error ?? message } catch {}
  return new Error(message)
}

export async function loadDeck() {
  const response = await fetch('/__mdeck/deck', { headers: { Accept: 'application/json' } })
  if (!response.ok) throw await failure(response)
  return response.json()
}

export async function saveSource(source, base, { keepalive = false } = {}) {
  const response = await fetch('/__mdeck/source', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source, base }), keepalive })
  if (response.status === 409) throw new ConflictError(await response.json())
  if (!response.ok) throw await failure(response)
  return response.json()
}

export function onServerEvent(name, callback) {
  if (!import.meta.hot) return () => {}
  import.meta.hot.on(name, callback)
  return () => import.meta.hot.off?.(name, callback)
}
