// The ink controller and store run in the browser and import the bundled
// ink (virtual:deck-ink); here a loader hands them an empty one instead.
import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'

register('data:text/javascript,' + encodeURIComponent(`
  export const resolve = (specifier, context, next) => specifier === 'virtual:deck-ink' ? { url: 'virtual:deck-ink', shortCircuit: true } : next(specifier, context)
  export const load = (url, context, next) => url === 'virtual:deck-ink'
    ? { format: 'module', shortCircuit: true, source: 'export default { version: 1, width: 1920, height: 1080, slides: {} }; export const inkFileName = "talk.drawings.json"' }
    : next(url, context)
`))
// renameSlide also points the rendered slides at the new id.
globalThis.document = { querySelectorAll: () => [] }
globalThis.CSS = { escape: s => s }
const { createInkController } = await import('../src/runtime/ink/controller.js')
const { renameSlide, slideStrokes } = await import('../src/runtime/ink/store.js')

const points = [[10, 10, 0.5], [90, 40, 0.6]]

test('undoing the stroke that gave its slide an id is saved and shared under the new id', () => {
  const saved = [], shared = []
  const controller = createInkController({ storageKey: 'test', save: op => saved.push(op), publish: op => shared.push(op) })
  controller.addStroke({ slideId: 'slide-1', tool: 'pen', color: '#000', size: 4, points })
  assert.equal(saved[0].slideId, 'slide-1')
  // The server answered with the slide's new id (server.js).
  renameSlide('slide-1', 'the-important-part')
  assert.equal(slideStrokes('slide-1').length, 1)
  controller.undo()
  assert.deepEqual(saved.at(-1), { type: 'remove', slideId: 'the-important-part', ids: [saved[0].stroke.id] })
  assert.equal(shared.at(-1).slideId, 'the-important-part')
  assert.equal(slideStrokes('the-important-part').length, 0)
  controller.redo()
  assert.equal(saved.at(-1).slideId, 'the-important-part')
  assert.equal(slideStrokes('slide-1').length, 1)
})
