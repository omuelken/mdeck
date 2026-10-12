import test from 'node:test'
import assert from 'node:assert/strict'
import { retryDelay, compactOutbox } from '../src/runtime/ink/outbox.js'

test('live ink waits longer after each failed attempt, up to five seconds', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 10].map(retryDelay), [0, 250, 500, 1000, 2000, 4000, 5000, 5000])
})

test('while offline only the last dot and zoom of each sender are kept, and the oldest segments go first', () => {
  const seg = (key, from) => ({ type: 'segment', key, from, points: [[0, 0]] })
  const held = [
    { type: 'dot', key: 'a:dot', point: [1, 1] }, seg('a:1', 0), { type: 'zoom', key: 'a:zoom', scale: 2 },
    { type: 'dot', key: 'a:dot', point: [2, 2] }, { type: 'dot', key: 'b:dot', point: [5, 5] }, seg('a:1', 1),
    { type: 'end', key: 'a:1' }, { type: 'op', op: { type: 'add' } }, { type: 'zoom', key: 'a:zoom', scale: 1 },
  ]
  assert.deepEqual(compactOutbox(held).map(m => `${m.type}:${m.point ?? m.from ?? m.scale ?? ''}`),
    ['segment:0', 'dot:2,2', 'dot:5,5', 'segment:1', 'end:', 'op:', 'zoom:1'])
  const many = [...Array.from({ length: 6 }, (_, i) => seg('a:1', i)), { type: 'end', key: 'a:1' }, { type: 'op', op: {} }]
  assert.deepEqual(compactOutbox(many, 4).map(m => m.from ?? m.type), [4, 5, 'end', 'op'], 'ends and saved changes always stay')
})
