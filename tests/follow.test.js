import test from 'node:test'
import assert from 'node:assert/strict'
import { createFollower, clampToShown } from '../src/runtime/follow.js'

test('a follower goes with the presenter while live', () => {
  const f = createFollower()
  assert.deepEqual(f.presenter({ index: 2, step: -1 }), { index: 2, step: -1 })
  assert.deepEqual(f.presenter({ index: 3, step: 0 }), { index: 3, step: 0 })
  assert.equal(f.state.live, true)
})

test('paging back leaves live; the presenter then moves alone until Back to live', () => {
  const f = createFollower()
  f.presenter({ index: 5, step: -1 })
  assert.equal(f.moved({ index: 3, step: -1 }), null)
  assert.equal(f.state.live, false)
  assert.equal(f.presenter({ index: 6, step: -1 }), null, 'the follower stays where they are')
  assert.deepEqual(f.backToLive(), { index: 6, step: -1 })
  assert.equal(f.state.live, true)
})

test('a follower cannot see slides or steps the presenter has not shown', () => {
  const f = createFollower()
  f.presenter({ index: 4, step: 1 })
  assert.deepEqual(f.moved({ index: 5, step: -1 }), { index: 4, step: 1 }, 'the next slide is not shown yet')
  assert.deepEqual(f.moved({ index: 4, step: 2 }), { index: 4, step: 1 }, 'nor the next step')
  assert.equal(f.state.live, true, 'held at the presenter, the follower is live')
  f.presenter({ index: 2, step: -1 })
  assert.equal(f.moved({ index: 4, step: 1 }), null, 'going back, what was shown stays open')
})

test('before the talk starts, only the first slide', () => {
  assert.deepEqual(clampToShown({ index: 7, step: 2 }, null), { index: 0, step: -1 })
  const f = createFollower()
  assert.deepEqual(f.moved({ index: 3, step: -1 }), { index: 0, step: -1 })
  assert.equal(f.state.live, true)
})
