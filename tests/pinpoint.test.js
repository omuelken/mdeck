import test from 'node:test'
import assert from 'node:assert/strict'
import { tapOf, parseTarget, targetOn, shapesOf, solutionOf, isInside, tapText } from '../src/components/pinpoint.js'
import { normalizeResults, withRoom, resultsCsv } from '../src/core/results.js'
import { activitiesIn, resultsReport, reportAnswersCsv, reportSummaryCsv } from '../src/core/resultsReport.js'
import { parseSlides } from '../src/core/parseSlides.js'
import { hasActivity } from '../src/core/editDeck.js'
import { collectLocalAssetRefs } from '../src/build/slidesPlugin.js'

test('a tap is two numbers from 0 to 1', () => {
  assert.deepEqual(tapOf({ x: 0.123456, y: 1 }), { x: 0.1235, y: 1 })
  for (const bad of [null, 'x', { x: 0.5 }, { x: -0.1, y: 0.5 }, { x: 0.5, y: 1.2 }, { x: '0.5', y: NaN }]) assert.equal(tapOf(bad), null, JSON.stringify(bad))
  assert.equal(tapText({ x: 0.6213, y: 0.3 }), '62.1% 30%')
})

test('the answer is a circle in pixels or in percent of the picture', () => {
  assert.deepEqual(parseTarget('412, 230, 40'), [{ type: 'circle', x: 412, y: 230, r: 40, unit: 'px' }])
  assert.deepEqual(parseTarget('62% 31% 8%'), [{ type: 'circle', x: 62, y: 31, r: 8, unit: '%' }])
  assert.deepEqual(parseTarget('circle 412 230 40'), parseTarget('412 230 40'))
  for (const bad of ['', '62% 31%', '62% 31 8%', '1 2 0', 'a b c', '1 2 3 4', 'oval 1 2 3', 'rect 1 2 3', 'rect 1 2 0 5', 'poly 1 2 3 4', 'poly 1 2 3 4 5', '1 2 3 |', '1 2 3 | rect 1 2']) assert.equal(parseTarget(bad), null, bad)
  const size = { width: 800, height: 400 }
  assert.deepEqual(targetOn(parseTarget('50% 25% 10%'), size), [{ type: 'circle', x: 0.5, y: 0.25, r: 0.1, ratio: 0.5 }])
  assert.deepEqual(targetOn(parseTarget('400 100 80'), size), [{ type: 'circle', x: 0.5, y: 0.25, r: 0.1, ratio: 0.5 }])
  assert.equal(targetOn(parseTarget('400 100 80'), null), null, 'pixels need the picture loaded')
})

test('the answer can be a rectangle, a polygon, or several shapes', () => {
  const size = { width: 800, height: 400 }
  assert.deepEqual(targetOn(parseTarget('rect 200 100 400 200'), size), [{ type: 'rect', x: 0.25, y: 0.25, w: 0.5, h: 0.5 }])
  assert.deepEqual(targetOn(parseTarget('rect 25% 25% 50% 50%'), size), targetOn(parseTarget('rect 200 100 400 200'), size))
  assert.deepEqual(targetOn(parseTarget('poly 0 0, 800 0; 400 400'), size), [{ type: 'poly', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 1 }] }])
  const set = parseTarget('circle 400 200 40 | rect 0 0 80 40 | poly 10% 10% 20% 10% 20% 20%')
  assert.deepEqual(set.map(shape => [shape.type, shape.unit]), [['circle', 'px'], ['rect', 'px'], ['poly', '%']], 'each shape has its own unit')
  assert.equal(targetOn(set, size).length, 3)
})

test('a tap counts in any of the shapes', () => {
  const shapes = targetOn(parseTarget('rect 0 0 100 100 | poly 400 0 800 0 800 400 | circle 200 300 50'), { width: 800, height: 400 })
  assert.ok(isInside({ x: 0.05, y: 0.1 }, shapes), 'in the rect')
  assert.ok(isInside({ x: 0.9, y: 0.5 }, shapes), 'in the polygon')
  assert.ok(!isInside({ x: 0.55, y: 0.9 }, shapes), 'below the polygon diagonal')
  assert.ok(isInside({ x: 0.25, y: 0.75 }, shapes), 'in the circle')
  assert.ok(!isInside({ x: 0.5, y: 0.5 }, shapes))
  assert.ok(isInside({ x: 0.125, y: 0.25 }, shapes), 'the edge of the rect counts')
  assert.ok(!isInside(null, shapes))
})

test('the circle stays round on a picture that is not square', () => {
  // 800 × 400: a radius of 80 px is 0.1 of the width and 0.2 of the height.
  const circle = [{ type: 'circle', x: 0.5, y: 0.5, r: 0.1, ratio: 0.5 }]
  assert.ok(isInside({ x: 0.5, y: 0.69 }, circle), '76 px below the centre')
  assert.ok(!isInside({ x: 0.5, y: 0.71 }, circle), '84 px below the centre')
  assert.ok(isInside({ x: 0.59, y: 0.5 }, circle))
  assert.ok(!isInside({ x: 0.61, y: 0.5 }, circle))
})

test('a lone circle is kept as it was, other shapes as a list', () => {
  const circle = { x: 0.5, y: 0.5, r: 0.1, ratio: 0.5 }
  assert.deepEqual(solutionOf(shapesOf(circle)), { type: 'circle', ...circle })
  assert.deepEqual(shapesOf(circle), [{ type: 'circle', ...circle }], 'a circle kept by an earlier version')
  const mixed = [{ type: 'circle', ...circle }, { type: 'rect', x: 0, y: 0, w: 0.1, h: 0.1 }]
  assert.deepEqual(shapesOf(JSON.parse(JSON.stringify(solutionOf(mixed)))), mixed)
  for (const bad of [null, ['A'], { x: 0.5, y: 0.5, r: 0, ratio: 1 }, { shapes: [] }, { shapes: [{ type: 'rect', x: 0, y: 0, w: 0, h: 1 }] }, { shapes: [{ type: 'poly', points: [{ x: 0, y: 0 }] }] }]) assert.equal(shapesOf(bad), null, JSON.stringify(bad))
  assert.equal(solutionOf(null), null)
})

const deck = `---
meta:
  title: Anatomy
---
---
# Where is the left atrium?

<pinpoint room="heart" src="img/heart.png" answer="62% 31% 8%" />
`

test('a pinpoint is an activity with a picture of the deck', () => {
  const parsed = parseSlides(deck)
  assert.ok(hasActivity(parsed.slides[0]))
  assert.ok(collectLocalAssetRefs(deck).includes('img/heart.png'))
  assert.deepEqual(activitiesIn(parsed).map(activity => [activity.room, activity.kind, activity.question]), [['heart', 'spot', 'Where is the left atrium?']])
})

test('kept taps are written as positions, and counted on target with the circle the slide kept', () => {
  const solution = { x: 0.5, y: 0.5, r: 0.1, ratio: 0.5 }
  const answers = [{ phone: 1, at: 't1', value: { x: 0.1, y: 0.1 } }, { phone: 2, at: 't2', value: { x: 0.5, y: 0.69 } }, { phone: 1, at: 't3', value: { x: 0.52, y: 0.5 } }, { phone: 3, at: 't4', value: { x: 0.5, y: 0.8 } }]
  const results = withRoom(normalizeResults({}), 'heart', { answers, solution })
  assert.deepEqual(normalizeResults(JSON.parse(JSON.stringify(results))).rooms.heart.solution, solution, 'the circle survives the file')
  assert.match(resultsCsv(results), /^room,phone,at,answer\nheart,1,t1,10% 10%\n/)
  const report = resultsReport(results, parseSlides(deck))
  assert.deepEqual(report[0].summary.counts, [{ answer: 'on target', count: 2 }, { answer: 'off target', count: 1 }], "each phone's latest tap")
  assert.equal(report[0].summary.voted, 3)
  assert.equal(reportAnswersCsv(report).split('\n')[2], '1,heart,spot,Where is the left atrium?,2,t2,50% 69%')
  assert.ok(reportSummaryCsv(report).includes('1,heart,spot,Where is the left atrium?,on target,2,67%'))
  // Without a kept circle the taps are still there, but nothing counts as on target.
  const plain = resultsReport(withRoom(normalizeResults({}), 'heart', { answers }), parseSlides(deck))
  assert.deepEqual(plain[0].summary.counts, [])
  // Several shapes: a tap in any of them is on target.
  const several = { shapes: [{ type: 'circle', x: 0.5, y: 0.5, r: 0.1, ratio: 0.5 }, { type: 'rect', x: 0.4, y: 0.7, w: 0.2, h: 0.2 }] }
  const both = resultsReport(withRoom(normalizeResults({}), 'heart', { answers, solution: several }), parseSlides(deck))
  assert.deepEqual(both[0].summary.counts, [{ answer: 'on target', count: 3 }, { answer: 'off target', count: 0 }])
})
