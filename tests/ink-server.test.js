// How a window follows the ink file: with the changes the server names, it
// applies just those; only without them does it fetch all the ink again.
import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { applyOp, emptyInk } from '../src/core/ink.js'
import { createInkFile } from '../src/build/inkPlugin.js'

register('data:text/javascript,' + encodeURIComponent(`
  export const resolve = (specifier, context, next) => specifier === 'virtual:deck-ink' ? { url: 'virtual:deck-ink', shortCircuit: true } : next(specifier, context)
  export const load = (url, context, next) => url === 'virtual:deck-ink'
    ? { format: 'module', shortCircuit: true, source: 'export default { version: 1, width: 1920, height: 1080, slides: {} }; export const inkFileName = "talk.drawings.json"' }
    : next(url, context)
`))
globalThis.window = { location: { href: 'http://localhost/' } }
globalThis.document = { querySelectorAll: () => [] }
globalThis.CSS = { escape: s => s }
const { connectInkServer } = await import('../src/runtime/ink/server.js')
const { createInkController } = await import('../src/runtime/ink/controller.js')
const { slideStrokes } = await import('../src/runtime/ink/store.js')

const stroke = (id, x = 10) => ({ id, tool: 'pen', color: '#e11d48', size: 6, points: [[x, 10, 0.5], [90, 40, 0.6]] })

async function connected(ink) {
  const requests = [], handlers = {}
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url, method: options.method ?? 'GET', body: options.body && JSON.parse(options.body) })
    return { ok: true, json: async () => ({ ink, deckHash: 'first', renamed: [] }) }
  }
  const controller = createInkController({ storageKey: 'test' })
  assert.equal(await connectInkServer(controller, { headers: () => ({}), hot: { on: (name, handler) => { handlers[name] = handler } } }), true)
  return { controller, requests, tell: message => handlers['mdeck:ink'](message), fetches: () => requests.filter(request => request.method === 'GET').length }
}

test('a stroke the server names is applied without fetching all the ink', async () => {
  const { tell, fetches } = await connected(applyOp(emptyInk(), { type: 'add', slideId: 'other', stroke: stroke('a:1') }))
  const other = slideStrokes('other')
  assert.equal(fetches(), 1)
  tell({ renamed: [], ops: [{ type: 'add', slideId: 's', stroke: stroke('b:1') }], deckHash: 'first' })
  assert.equal(fetches(), 1)
  assert.deepEqual(slideStrokes('s').map(s => s.id), ['b:1'])
  assert.equal(slideStrokes('other'), other, 'a slide that did not change keeps its strokes and is not drawn again')
})

test('without the changes, a window fetches the ink as before', async () => {
  const { tell, fetches } = await connected(emptyInk())
  tell({ renamed: [] })
  await new Promise(done => setImmediate(done))
  assert.equal(fetches(), 2)
})

test('the deck hash the server names goes with the next change', async () => {
  const { controller, requests, tell } = await connected(emptyInk())
  tell({ renamed: [], ops: [], deckHash: 'second' })
  controller.addStroke({ slideId: 's2', tool: 'pen', color: '#000', size: 4, points: [[1, 1, 0.5], [2, 2, 0.5]] })
  await new Promise(done => setImmediate(done))
  assert.equal(requests.find(request => request.method === 'POST').body.deckHash, 'second')
})

test('hearing the same change again leaves the ink as it is, and a real change does not', () => {
  const ink = applyOp(applyOp(emptyInk(), { type: 'add', slideId: 's', stroke: stroke('a:1') }), { type: 'add', slideId: 's', stroke: stroke('a:2') })
  assert.equal(applyOp(ink, { type: 'add', slideId: 's', stroke: stroke('a:1') }), ink)
  assert.equal(applyOp(ink, { type: 'remove', slideId: 's', ids: ['gone:1'] }), ink)
  const moved = applyOp(ink, { type: 'add', slideId: 's', stroke: stroke('a:1', 50) })
  assert.notEqual(moved, ink)
  assert.equal(moved.slides.s.find(s => s.id === 'a:1').points[0][0], 50)
})

test('the ink file names the changes it applied and the hash, but not when it was replaced', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'mdeck-ink-server-'))
  const deck = resolve(dir, 'talk.md')
  writeFileSync(deck, '---\ntheme: neue\n---\n\n---\nid: first\n---\n# First\n')
  const changes = []
  const file = createInkFile(deck, { debounceMs: 5, onChange: change => changes.push(change) })
  const { deckHash } = file.read()
  const op = { type: 'add', slideId: 'first', stroke: stroke('a:1') }
  assert.equal(file.apply([op], deckHash).status, 200)
  assert.deepEqual(changes.at(-1), { renamed: [], ops: [op], deckHash })
  file.drop()
  assert.deepEqual(changes.at(-1), { renamed: [] })
  file.flush()
})
