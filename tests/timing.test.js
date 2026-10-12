import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { parseTime, formatTime, formatClock, roundTime, planFor, scheduleAt, initialTimes, changedTimes } from '../src/core/timing.js'
import { parseSlides } from '../src/core/parseSlides.js'
import { validateDeck } from '../src/core/validateDeck.js'
import { setSlideMeta } from '../src/core/editDeck.js'
import { createTimingFile } from '../src/build/timingPlugin.js'
import { isOwnWrite } from '../src/build/ownWrites.js'

test('times are written in seconds, minutes or both; a bare number is minutes', () => {
  for (const [text, seconds] of [['90s', 90], ['2m', 120], ['1m30s', 90], ['1m 30s', 90], ['1.5m', 90], ['2min', 120], [2, 120], [0.5, 30], ['3', 180], [' 45s ', 45]]) {
    assert.equal(parseTime(text), seconds, String(text))
  }
  for (const bad of ['2 mins', 'm', '', 'soon', '0s', 0, -1, null, true, {}]) assert.equal(parseTime(bad), null, String(bad))
})

test('mdeck writes times one way, and rounds rehearsed ones to 15 seconds', () => {
  assert.deepEqual([45, 60, 90, 125, 3600].map(formatTime), ['45s', '1m', '1m30s', '2m5s', '60m'])
  assert.deepEqual([5, 0, 245, -75, 3725].map(formatClock), ['0:05', '0:00', '4:05', '-1:15', '1:02:05'])
  assert.deepEqual([1, 7, 8, 22, 23, 98].map(s => roundTime(s)), [15, 15, 15, 15, 30, 105])
})

const slides = (...times) => times.map((time, i) => ({ id: `s${i}`, meta: time == null ? {} : { time } }))

test('slides without a time share what the deck time leaves, or count as nothing', () => {
  assert.deepEqual(planFor(slides('1m', null, '2m')).perSlide, [60, 0, 120])
  const plan = planFor(slides('1m', null, null), { time: '5m' })
  assert.deepEqual(plan.perSlide, [60, 120, 120])
  assert.deepEqual(plan.start, [0, 60, 180])
  assert.equal(plan.total, 300)
  assert.equal(plan.budget, 300)
  // More planned than the deck time: the rest get nothing.
  assert.deepEqual(planFor(slides('4m', null), { time: '3m' }).perSlide, [240, 0])
  // Times a rehearsal just saved count instead of the slides' own; undefined takes one out.
  assert.deepEqual(planFor(slides('1m', '1m'), {}, { s0: '2m', s1: undefined }).perSlide, [120, 0])
})

test('the schedule tells the time left on a slide and how far behind or ahead the talk is', () => {
  const plan = planFor(slides('1m', '2m', '1m'))
  assert.deepEqual(scheduleAt(plan, 1, { totalElapsed: 90, slideElapsed: 30 }), { planned: 120, slideLeft: 90, delta: 0 })
  // Over the slide's time: behind by as much.
  assert.deepEqual(scheduleAt(plan, 1, { totalElapsed: 200, slideElapsed: 140 }), { planned: 120, slideLeft: -20, delta: 20 })
  // Quick on the first slide: ahead.
  assert.equal(scheduleAt(plan, 1, { totalElapsed: 20, slideElapsed: 0 }).delta, -40)
})

test('time is a setting of a slide and of the deck, and a wrong one is reported', () => {
  const codes = source => validateDeck(parseSlides(source)).filter(d => d.severity === 'error').map(d => d.code)
  assert.equal(parseSlides('---\ntime: 45m\n---\n# One\n').deckConfig.time, '45m')
  assert.equal(parseSlides('# One\n\n---\ntime: 2m\n---\n# Two\n').slides[1].meta.time, '2m')
  assert.equal(parseSlides('---\ntime: 2m\nlayout: title\n---\n# One\n').slides[0].meta.time, '2m')
  assert.deepEqual(codes('---\ntime: soon\n---\n# One\n'), ['invalid-config'])
  assert.deepEqual(codes('# One\n\n---\n:::meta\ntime: 2 mins\n:::\n# Two\n'), ['invalid-metadata'])
  assert.deepEqual(codes('# One\n\n---\n:::meta\ntime: 90s\n:::\n# Two\n'), [])
  // Adding a time keeps a slide's settings where they were.
  const deck = parseSlides('---\ntheme: neue\n---\n\n---\nlayout: title\n---\n# T\n')
  assert.equal(setSlideMeta(deck, 'slide-1', { time: '1m' }), '---\ntheme: neue\n---\n\n---\nlayout: title\ntime: 1m\n---\n# T\n')
})

test('the rehearsal offers the rehearsed times rounded, and saves only what changes', () => {
  const deck = slides('1m', null, '30s')
  const own = [60, null, 30]
  const next = initialTimes(deck, { s0: 52, s1: 100 }, own)
  assert.deepEqual(next, [45, 105, 30], 'a slide not rehearsed keeps its time')
  assert.deepEqual(changedTimes(deck, own, next), { s0: '45s', s1: '1m45s' })
  assert.deepEqual(changedTimes(deck, own, [60, null, null]), { s2: null })
})

function deckWith(source) {
  const dir = mkdtempSync(resolve(tmpdir(), 'mdeck-timing-'))
  const deck = resolve(dir, 'talk.md')
  writeFileSync(deck, source)
  return { dir, deck, file: createTimingFile(deck) }
}
const SOURCE = '---\ntheme: neue\n---\n\n---\n# One\n\n---\n:::meta\nid: two\ntime: 1m\n:::\n# Two\n\n---\n# Three\n'

test('saving a rehearsal writes the times into the slides and nothing else', () => {
  const { dir, deck, file } = deckWith(SOURCE)
  const ids = file.ids()
  assert.deepEqual(ids, ['slide-1', 'two', 'slide-3'])
  const result = file.save(ids, { 'slide-1': '1m30s', two: null, 'slide-3': '45s' })
  assert.deepEqual(result, { status: 200, ok: true, changed: 3 })
  const source = readFileSync(deck, 'utf8')
  assert.equal(source, '---\ntheme: neue\n---\n\n---\n:::meta\ntime: 1m30s\n:::\n# One\n\n---\n:::meta\nid: two\n:::\n# Two\n\n---\n:::meta\ntime: 45s\n:::\n# Three\n')
  assert.ok(isOwnWrite(deck, source), 'the open windows do not reload')
  assert.equal(readdirSync(resolve(dir, '.mdeck-backups')).length, 1, 'the deck from before is kept')
  assert.equal(readFileSync(resolve(dir, '.mdeck-backups', readdirSync(resolve(dir, '.mdeck-backups'))[0]), 'utf8'), SOURCE)
  // The same times again change nothing.
  assert.equal(file.save(file.ids(), { 'slide-1': '90s' }).changed, 0)
})

test('times are refused when the deck changed since the rehearsal began', () => {
  const { deck, file } = deckWith(SOURCE)
  const ids = file.ids()
  writeFileSync(deck, SOURCE.replace('# Three', '# Inserted\n\n---\n# Three'))
  assert.equal(file.save(ids, { 'slide-3': '1m' }).status, 409)
  assert.doesNotMatch(readFileSync(deck, 'utf8'), /time: 1m\n:::\n# Three/)
  assert.equal(file.save(file.ids(), { 'slide-1': '2 mins' }).status, 400)
  assert.equal(file.save(file.ids(), { nowhere: '1m' }).status, 400)
})
