import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { inkFileFor, emptyInk, normalizeInk, validateInk, orphanIds, applyOp, simplify, hitTest, strokePath, inkOrder, translateStroke, insidePolygon, strokesInLasso, strokesBox } from '../src/core/ink.js'
import { slidesPlugin } from '../src/build/slidesPlugin.js'
import { checkDeck } from '../src/build/check.js'
import { loadRegistry } from '../src/extensions/discover.js'
import { parseSlides } from '../src/core/parseSlides.js'

const stroke = (id, points = [[10, 10, 0.5], [60, 40, 0.7], [120, 20, 0.6]], extra = {}) => ({ id, tool: 'pen', color: '#e11d48', size: 6, points, ...extra })

test('the ink file sits beside the deck', () => {
  assert.equal(inkFileFor('/talks/lunch.md'), '/talks/lunch.drawings.json')
  assert.equal(inkFileFor('slides.MD'), 'slides.drawings.json')
})

test('normalizing drops broken strokes, rounds points and scales to the theme size', () => {
  const raw = { version: 1, width: 1920, height: 1080, slides: {
    intro: [stroke('a:1', [[10.26, 20.71, 0.444], [30, 40]]), { id: 'bad', points: [] }, 'nonsense'],
    empty: [],
    other: 'x',
  } }
  const ink = normalizeInk(raw)
  assert.deepEqual(Object.keys(ink.slides), ['intro'])
  assert.deepEqual(ink.slides.intro[0].points, [[10, 21, 0.44], [30, 40, 0.5]])
  const half = normalizeInk(raw, { width: 960, height: 540 })
  assert.deepEqual(half.slides.intro[0].points[0], [5, 10, 0.44])
  assert.equal(half.slides.intro[0].size, 3)
  assert.deepEqual(normalizeInk(null), emptyInk())
  assert.equal(normalizeInk({ slides: { s: [stroke('x', [[1, 1]], { tool: 'laser', color: 'url(evil)' })] } }).slides.s[0].tool, 'pen', 'unknown tools and colours fall back')
})

test('validation reports what a hand-edited file got wrong', () => {
  assert.deepEqual(validateInk({ version: 1, slides: {} }), [])
  assert.equal(validateInk([]).length, 1)
  const messages = validateInk({ version: 2, slides: { a: 'x', b: [{ points: [] }] } }).map(p => p.message)
  assert.equal(messages.length, 3)
  assert.match(messages[0], /version 2/)
})

test('changes apply once, whatever order the devices send them in', () => {
  let ink = emptyInk()
  ink = applyOp(ink, { type: 'add', slideId: 's', stroke: stroke('ipad:1') })
  const twice = applyOp(ink, { type: 'add', slideId: 's', stroke: stroke('ipad:1') })
  assert.equal(twice.slides.s.length, 1, 'adding the same stroke again replaces it')
  ink = applyOp(twice, { type: 'add', slideId: 's', stroke: stroke('laptop:1') })
  const known = ['ipad:1']
  ink = applyOp(ink, { type: 'clear', slideId: 's', ids: known })
  assert.deepEqual(ink.slides.s.map(s => s.id), ['laptop:1'], 'clear keeps strokes the clearing device did not know')
  ink = applyOp(ink, { type: 'remove', slideId: 's', ids: ['laptop:1'] })
  assert.equal(ink.slides.s, undefined, 'a slide without strokes has no entry')
  const renamed = applyOp(applyOp(emptyInk(), { type: 'add', slideId: 'slide-3', stroke: stroke('a:1') }), { type: 'rename', from: 'slide-3', to: 'lunch' })
  assert.deepEqual(Object.keys(renamed.slides), ['lunch'])
  assert.equal(applyOp(renamed, { type: 'nonsense' }), renamed)
})

test('finished strokes are simplified, and the eraser finds them', () => {
  const line = Array.from({ length: 50 }, (_, i) => [i * 2, 100, 0.5])
  assert.equal(simplify(line).length, 2, 'a straight line needs two points')
  const corner = [[0, 0, 0.5], [50, 0, 0.5], [100, 0, 0.5], [100, 50, 0.5], [100, 100, 0.5]]
  assert.deepEqual(simplify(corner).map(p => p.slice(0, 2)), [[0, 0], [100, 0], [100, 100]])
  const s = stroke('a', [[0, 0, 0.5], [100, 0, 0.5]])
  assert.equal(hitTest(s, [50, 5]), true)
  assert.equal(hitTest(s, [50, 60]), false)
  assert.match(strokePath(s), /^M [\d.-]+ [\d.-]+ Q .* Z$/)
})

test('a lasso selects strokes mostly inside it, and a moved stroke replaces its original', () => {
  const inside = { id: 'a', tool: 'pen', color: '#000', size: 6, points: [[10, 10, 0.5], [20, 10, 0.5], [30, 12, 0.5]] }
  const half = { id: 'b', tool: 'pen', color: '#000', size: 6, points: [[40, 40, 0.5], [200, 40, 0.5]] }
  const outside = { id: 'c', tool: 'pen', color: '#000', size: 6, points: [[300, 300, 0.5], [320, 300, 0.5]] }
  const lasso = [[0, 0], [100, 0], [100, 100], [0, 100]]
  assert.equal(insidePolygon([50, 50], lasso), true)
  assert.equal(insidePolygon([150, 50], lasso), false)
  assert.deepEqual(strokesInLasso([inside, half, outside], lasso).map(s => s.id), ['a', 'b'])
  assert.deepEqual(strokesInLasso([inside], [[0, 0], [100, 0]]), [], 'two points are no lasso')
  assert.deepEqual(strokesBox([inside], 2), [5, 5, 35, 17])
  assert.equal(strokesBox([]), null)

  const moved = translateStroke(inside, 5, -5)
  assert.equal(moved.id, 'a')
  assert.deepEqual(moved.points[0], [15, 5, 0.5])
  const ink = applyOp(applyOp(emptyInk(), { type: 'add', slideId: 's', stroke: inside }), { type: 'add', slideId: 's', stroke: moved })
  assert.equal(ink.slides.s.length, 1)
  assert.deepEqual(ink.slides.s[0].points[0], [15, 5, 0.5])
})

test('a finished stroke reaches its last point', () => {
  const points = Array.from({ length: 20 }, (_, i) => [100 + i * 20, 200, 0.5])
  const right = d => Math.max(...d.match(/-?\d+(\.\d+)?/g).map(Number).filter((_, i) => i % 2 === 0))
  assert.ok(right(strokePath({ tool: 'pen', size: 6, points })) >= 480, 'the outline runs to x = 480')
  assert.ok(right(strokePath({ tool: 'pen', size: 6, points }, { last: false })) < right(strokePath({ tool: 'pen', size: 6, points })))
})

test('renaming a slide twice, or onto ink it already has, does not double strokes', () => {
  const stroke = { id: 'a', tool: 'pen', color: '#000', size: 6, points: [[1, 2, 0.5], [3, 4, 0.5]] }
  let ink = applyOp(emptyInk(), { type: 'add', slideId: 'old', stroke })
  ink = applyOp(ink, { type: 'add', slideId: 'new', stroke })
  ink = applyOp(ink, { type: 'rename', from: 'old', to: 'new' })
  assert.equal(ink.slides.new.length, 1)
  assert.equal(ink.slides.old, undefined)
})

test('the highlighter is drawn below the pen', () => {
  const pen = { id: 'p', tool: 'pen' }, highlighter = { id: 'h', tool: 'highlighter' }
  assert.deepEqual(inkOrder([pen, highlighter]).map(s => s.id), ['h', 'p'])
})

test('orphaned ink is found after a slide was removed', () => {
  const deck = parseSlides('---\ntheme: neue\n---\n\n---\nid: intro\n---\n# A\n')
  const ink = normalizeInk({ slides: { intro: [stroke('a')], gone: [stroke('b')] } })
  assert.deepEqual(orphanIds(ink, deck.slides), ['gone'])
})

test('the slides plugin bundles the ink file, scaled to the deck, or nothing with --no-drawings', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'mdeck-ink-'))
  const deck = resolve(dir, 'talk.md')
  writeFileSync(deck, '---\ntheme: neue\nwidth: 960\nheight: 540\n---\n\n---\nid: intro\n---\n# A\n')
  const load = options => {
    const plugin = slidesPlugin(deck, options)
    const watched = []
    const code = plugin.load.call({ addWatchFile: file => watched.push(file), warn() {} }, plugin.resolveId('virtual:deck-ink'))
    const [first, second] = code.split('\n')
    return { data: JSON.parse(first.replace(/^export default /, '')), name: JSON.parse(second.replace(/^export const inkFileName = /, '')), watched }
  }
  assert.deepEqual(load().data, emptyInk({ width: 960, height: 540 }), 'no ink file yet')
  assert.deepEqual(load().watched, [], 'a missing file is not watched as a dependency, or Vite fails to load the page')
  writeFileSync(inkFileFor(deck), JSON.stringify({ version: 1, width: 1920, height: 1080, slides: { intro: [stroke('a:1', [[100, 100, 0.5]])] } }))
  const { data, watched } = load()
  assert.deepEqual(data.slides.intro[0].points, [[50, 50, 0.5]])
  assert.deepEqual(watched, [inkFileFor(deck)])
  assert.equal(load().name, 'talk.drawings.json', 'the name for downloading the file')
  assert.deepEqual(load({ ink: false }).data.slides, {})
})

test('mdeck check reports broken ink files and ink for missing slides', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'mdeck-ink-check-'))
  const deck = resolve(dir, 'talk.md')
  writeFileSync(deck, '---\ntheme: neue\n---\n\n---\nid: intro\n---\n# A\n')
  const codes = () => checkDeck(deck, loadRegistry(deck)).diagnostics.map(d => [d.code, d.severity])
  assert.deepEqual(codes(), [])
  writeFileSync(inkFileFor(deck), '{ not json')
  assert.deepEqual(codes(), [['invalid-ink', 'error']])
  writeFileSync(inkFileFor(deck), JSON.stringify({ version: 1, slides: { intro: [stroke('a')], gone: [stroke('b')] } }))
  assert.deepEqual(codes(), [['ink-orphan', 'warning']])
})
