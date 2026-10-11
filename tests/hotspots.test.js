import test from 'node:test'
import assert from 'node:assert/strict'
import { hotspotZoom, hotspotMode, normalMode, readingOrder, zoomToCamera, cameraToZoom } from '../src/runtime/hotspots.js'
import { parseSlides } from '../src/core/parseSlides.js'
import { validateDeck } from '../src/core/validateDeck.js'

const design = { width: 1920, height: 1080 }

test('a wide part fills the width, a tall one the height, with room around it', () => {
  // 960 wide: twice the slide, less the margin on each side.
  const wide = hotspotZoom({ x: 480, y: 100, w: 960, h: 100 }, design)
  assert.ok(Math.abs(wide.scale - 2 / 1.12) < 1e-9)
  assert.deepEqual([wide.x, wide.y], [960, 150])
  const tall = hotspotZoom({ x: 100, y: 0, w: 200, h: 540 }, design)
  assert.ok(Math.abs(tall.scale - 2 / 1.12) < 1e-9, 'a tall part is limited by the slide height')
  assert.deepEqual([tall.x, tall.y], [200, 270])
})

test('a tiny part stops at the largest zoom; one that nearly fills the slide gets no key', () => {
  assert.equal(hotspotZoom({ x: 0, y: 0, w: 10, h: 10 }, design, { max: 6 }).scale, 6)
  assert.equal(hotspotZoom({ x: 40, y: 40, w: 1840, h: 1000 }, design), null)
  assert.equal(hotspotZoom({ x: 0, y: 0, w: 0, h: 10 }, design), null)
})

test('the stage zoom and the camera convert both ways', () => {
  const zoom = { scale: 3, x: 400, y: 300 }
  assert.deepEqual(zoomToCamera(zoom, design), { x: 400, y: 300, w: 640 })
  assert.deepEqual(cameraToZoom(zoomToCamera(zoom, design), design), zoom)
})

test('hotspots are off unless the deck, the slide or the presenter turns them on', () => {
  assert.equal(hotspotMode({}), 'off')
  assert.equal(hotspotMode({ deck: 'auto' }), 'auto')
  assert.equal(hotspotMode({ deck: 'auto', slide: 'off' }), 'off')
  assert.equal(hotspotMode({ deck: 'off', slide: 'marked' }), 'marked')
  assert.equal(hotspotMode({ deck: 'true' }), 'auto')
  assert.equal(hotspotMode({ deck: 'off', forced: true }), 'auto')
  assert.equal(hotspotMode({ deck: 'marked', forced: true }), 'marked')
  assert.equal(hotspotMode({ deck: 'auto', slide: 'false', forced: true }), 'off', "a slide's own off stays off")
  assert.equal(hotspotMode({ deck: 'auto', forced: false }), 'off')
  assert.equal(normalMode('sometimes'), null)
})

test('keys follow reading order: rows top to bottom, each row left to right', () => {
  const at = (name, x, y, w = 100, h = 100) => ({ name, rect: { x, y, w, h } })
  const items = [at('c', 0, 400), at('b', 600, 20), at('a', 40, 0, 100, 300)]
  assert.deepEqual(readingOrder(items).map(i => i.name), ['a', 'b', 'c'])
  assert.deepEqual(readingOrder(items, { rtl: true }).map(i => i.name), ['b', 'a', 'c'])
})

test('the hotspots setting is checked on the deck and on slides', () => {
  const codes = source => validateDeck(parseSlides(source)).map(d => d.code)
  assert.deepEqual(codes('---\nhotspots: auto\n---\n# One\n\n---\nhotspots: false\n---\n# Two\n'), [])
  assert.deepEqual(codes('---\nhotspots: marked\n---\n# One\n'), [])
  assert.deepEqual(codes('---\nhotspots: always\n---\n# One\n'), ['invalid-config'])
  assert.deepEqual(codes('# One\n\n---\nhotspots: 3\n---\n# Two\n'), ['invalid-metadata'])
  assert.equal(parseSlides('---\nhotspots: auto\n---\n# One\n').deckConfig.hotspots, 'auto')
  // With a slide's own key beside it, the first block is the first slide's.
  const first = parseSlides('---\nhotspots: off\nlayout: title\n---\n# One\n')
  assert.equal(first.deckConfig.hotspots, undefined)
  assert.equal(first.slides[0].meta.hotspots, 'off')
  assert.equal(parseSlides('---\nhotspots: marked\ntheme: neue\n---\n# One\n').deckConfig.hotspots, 'marked')
})

test('a slide setting edited in the editor stays the slide\'s', async () => {
  const { setSlideMeta, setDeckConfig } = await import('../src/core/editDeck.js')
  const deck = parseSlides('---\nlayout: title\n---\n# T\n\n---\n# Next\n')
  const edited = parseSlides(setSlideMeta(deck, deck.slides[0].id, { layout: undefined, hotspots: 'auto' }))
  assert.equal(edited.deckConfig.hotspots, undefined)
  assert.equal(edited.slides.length, 2)
  assert.equal(edited.slides[0].meta.hotspots, 'auto')
  const config = parseSlides(setDeckConfig(parseSlides('# T\n'), { hotspots: 'marked' }))
  assert.equal(config.deckConfig.hotspots, 'marked')
  assert.equal(config.slides.length, 1)
})
