import test from 'node:test'
import assert from 'node:assert/strict'
import { createOrder } from '../src/runtime/syncOrder.js'

test('a position that arrives after a newer change is ignored', () => {
  const presenter = createOrder('p'), audience = createOrder('a')
  // The presenter resets; the message arrives, then a late duplicate.
  const reset = presenter.stamp()
  assert.equal(audience.accept(reset), true)
  // The audience window moves on before the duplicate arrives.
  const moved = audience.stamp()
  assert.equal(audience.accept(reset), false, 'the late copy does not take it back')
  assert.equal(presenter.accept(moved), true, 'and the presenter follows the newer change')
})

test('changes made at the same moment end on the same side in both windows', () => {
  const presenter = createOrder('p'), audience = createOrder('a')
  const fromPresenter = presenter.stamp(), fromAudience = audience.stamp()
  const presenterTakes = presenter.accept(fromAudience), audienceTakes = audience.accept(fromPresenter)
  assert.notEqual(presenterTakes, audienceTakes, 'exactly one of them gives way')
  assert.equal(audienceTakes, true, 'the larger id wins, on both sides')
})

test('a window that just opened takes the current position, and old pages are followed', () => {
  const presenter = createOrder('p')
  presenter.stamp(); presenter.stamp()
  assert.equal(createOrder('z').accept(presenter.current()), true)
  assert.equal(createOrder('a').accept(undefined), true)
  // Neither has moved yet: the newcomer still takes the presenter's position.
  assert.equal(createOrder('zz').accept(createOrder('p').current()), true)
})

test('three windows converge when tied changes arrive in different orders', () => {
  const b = createOrder('b').stamp(), c = createOrder('c').stamp()
  const first = createOrder('a'), second = createOrder('z')
  assert.equal(first.accept(c), true)
  assert.equal(first.accept(b), false, 'the lower sender cannot replace the accepted winner')
  assert.equal(second.accept(b), true)
  assert.equal(second.accept(c), true)
  assert.deepEqual(first.current(), second.current(), 'both windows describe the same winning change')
  assert.deepEqual(first.stamp(), { seq: 2, from: 'a' }, 'a local change after receiving still advances the clock')
})

test('forwarding the current position preserves its original sender', () => {
  const winner = createOrder('c').stamp()
  const middle = createOrder('a')
  middle.accept(winner)
  assert.deepEqual(middle.current(), { ...winner, initial: true })
  const other = createOrder('b')
  other.stamp()
  assert.equal(other.accept(middle.current()), true, 'the forwarded winner still outranks a tied local change')
  assert.equal(middle.accept({ seq: 1, from: 'b', initial: true }), false, 'initial replies cannot bypass ordering after navigation')
})

test('a reloaded window carries its clock on, so its changes are not behind the audience window’s', () => {
  const kept = new Map()
  const storage = { getItem: key => kept.get(key) ?? null, setItem: (key, value) => kept.set(key, value) }
  const audience = createOrder('a')
  const presenter = createOrder('p', { storageKey: 'order', storage })
  for (let i = 0; i < 3; i++) audience.accept(presenter.stamp())
  audience.accept(audience.stamp())
  assert.equal(presenter.accept({ seq: 4, from: 'a' }), true, 'what it took from others is kept too')
  // The presenter view reloads: a new id, the same clock.
  const reloaded = createOrder('q', { storageKey: 'order', storage })
  assert.equal(audience.accept(reloaded.stamp()), true)
  assert.deepEqual(reloaded.current(), { seq: 5, from: 'q', initial: true })
  // Without a key, or with nothing kept, the clock starts at 0 as before.
  assert.deepEqual(createOrder('x').current(), { seq: 0, from: 'x', initial: true })
  assert.deepEqual(createOrder('x', { storageKey: 'other', storage }).current(), { seq: 0, from: 'x', initial: true })
  assert.deepEqual(createOrder('x', { storageKey: 'order', storage: { getItem() { throw new Error('blocked') } } }).current(), { seq: 0, from: 'x', initial: true })
})
