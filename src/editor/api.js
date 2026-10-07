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

export async function loadExtension(kind, id) {
  const response = await fetch(`/__mdeck/extension/${kind}/${id}`, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw await failure(response)
  return response.json()
}

// files: { name: text | null }; null removes a file. Returns the new registry.
export async function saveExtension(kind, id, files) {
  const response = await fetch(`/__mdeck/extension/${kind}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files }) })
  if (!response.ok) throw await failure(response)
  return response.json()
}

export async function deleteExtension(kind, id) {
  const response = await fetch(`/__mdeck/extension/${kind}/${id}`, { method: 'DELETE', headers: { Accept: 'application/json' } })
  if (!response.ok) throw await failure(response)
  return response.json()
}

// Every theme and palette mdeck and the theme repository offer, each marked
// whether it is available to every deck already.
export async function loadCatalogue() {
  const response = await fetch('/__mdeck/themes/catalogue', { headers: { Accept: 'application/json' } })
  if (!response.ok) throw await failure(response)
  return response.json()
}

// Installs a theme (with its default palette) or a palette for every deck.
// Returns the steps and the new registry.
export async function installPackage(kind, id) {
  const response = await fetch('/__mdeck/themes/install', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, id }) })
  if (!response.ok) throw await failure(response)
  return response.json()
}

// Removes a theme or palette for every deck (a built-in one is hidden).
export async function removePackage(kind, id) {
  const response = await fetch('/__mdeck/themes/remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, id }) })
  if (!response.ok) throw await failure(response)
  return response.json()
}
