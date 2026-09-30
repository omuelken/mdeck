// Saving ink through `mdeck dev` (src/build/inkPlugin.js). When the page was
// served by a dev server that lets it save, the controller's changes go
// there, batched, and changes from other windows arrive as `mdeck:ink`.
// Anywhere else (a built deck, a device that may not save) this returns false
// and the ink stays in this browser.
import { replaceInk, renameSlide } from './store.js'

const BASE = '/__mdeck/ink'

export async function connectInkServer(controller, { headers = () => ({}) } = {}) {
  let response
  try { response = await fetch(BASE, { cache: 'no-store', headers: headers() }) } catch { return false }
  if (!response.ok) return false
  let { ink, deckHash } = await response.json()

  // Changes made in this browser before the server was there go to it first.
  const earlier = controller.localChanges()
  replaceInk(ink)
  let queue = [], sending = false, stale = false

  async function refresh() {
    if (sending || queue.length) { stale = true; return }
    try {
      const fresh = await (await fetch(BASE, { cache: 'no-store', headers: headers() })).json()
      if (sending || queue.length) { stale = true; return }
      deckHash = fresh.deckHash
      replaceInk(fresh.ink)
    } catch {}
  }

  async function flush() {
    if (sending || !queue.length) return
    sending = true
    const ops = queue
    queue = []
    try {
      const reply = await fetch(`${BASE}/ops`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers() }, body: JSON.stringify({ deckHash, ops }) })
      const body = await reply.json().catch(() => ({}))
      if (reply.ok) {
        deckHash = body.deckHash
        for (const { from, to } of body.renamed ?? []) renameSlide(from, to)
      } else {
        // The deck changed under this page: take the server's ink.
        console.warn('mdeck: ink not saved:', body.error ?? reply.status)
        stale = true
      }
    } catch (error) {
      console.warn('mdeck: ink not saved:', error.message)
      queue = [...ops, ...queue]
    } finally {
      sending = false
    }
    if (queue.length) flush()
    else if (stale) { stale = false; refresh() }
  }

  const save = op => {
    queue.push(op)
    queueMicrotask(flush)
  }
  controller.useServer(save)
  for (const op of earlier) controller.replay(op)

  import.meta.hot?.on('mdeck:ink', ({ renamed = [] } = {}) => {
    for (const { from, to } of renamed) renameSlide(from, to)
    refresh()
  })
  return true
}
