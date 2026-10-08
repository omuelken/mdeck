import test from 'node:test'
import assert from 'node:assert/strict'
import { parseNumber, groupNumbers, isRightNumber } from '../src/components/numbers.js'
import { roomsIn, findRoomTag } from '../src/live/roomTag.js'

test('numbers typed on phones', () => {
  for (const [text, value] of [['0.5', 0.5], ['0,5', 0.5], [' -3 ', -3], ['−3', -3], ['1e-3', 0.001], ['1/2', 0.5], ['.25', 0.25], ['1 000', 1000]]) assert.equal(parseNumber(text), value, text)
  for (const text of ['', 'half', '1/0', '1/', '2x', '1,2,3', null]) assert.equal(parseNumber(text), null, String(text))
})

test('answers grouped by value, most frequent first, as most people typed them', () => {
  assert.deepEqual(groupNumbers(['1/2', '0.5', '0,5', '0.5', '2', 'nope']), [{ value: 0.5, n: 4, text: '0.5' }, { value: 2, n: 1, text: '2' }])
  assert.equal(groupNumbers(['1/3', '0.333333333333']).length, 1)
})

test('right within the tolerance, and despite floats without one', () => {
  assert.equal(isRightNumber(0.1 + 0.2, 0.3), true)
  assert.equal(isRightNumber(3.14, Math.PI), false)
  assert.equal(isRightNumber(3.14, Math.PI, 0.01), true)
  assert.equal(isRightNumber(null, 1), false)
})

test('a > or < inside an attribute does not end an activity tag', () => {
  const source = '<poll room="sign" question="Is $x > 0$ or $x<0$?" options="yes|no" />\n<scale room="pace" />'
  assert.deepEqual(roomsIn(source).map(found => found.room), ['sign', 'pace'])
  assert.equal(findRoomTag(source, 'sign'), '<poll room="sign" question="Is $x > 0$ or $x<0$?" options="yes|no" />')
})
