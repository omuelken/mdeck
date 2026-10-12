import test from 'node:test'
import assert from 'node:assert/strict'
import { setShared, getShared, receiveShared, connectShared, subscribeShared, setView, resetShared } from '../src/runtime/shared.js'

// Two windows: each with its own store would need two module copies, so the
// other window is played by hand through the messages it sends and receives.
test('a value set here reaches the other windows, and theirs reach this one', () => {
  resetShared()
  const sent = []
  connectShared(message => sent.push(message))
  assert.deepEqual(sent, [], 'a deck without shared state sends nothing')
  const heard = []
  subscribeShared('countdown', value => heard.push(value))
  assert.deepEqual(sent, [{ type: 'shared-ask' }], 'a window asks for what the others hold once a component listens')
  subscribeShared('other', () => {})
  assert.equal(sent.length, 1, 'and only once')
  assert.equal(setShared('countdown', { left: 300, running: true }), true)
  assert.deepEqual(sent.at(-1), { type: 'shared', name: 'countdown', value: { left: 300, running: true } })
  receiveShared({ type: 'shared', name: 'countdown', value: { left: 240, running: false } })
  assert.deepEqual(getShared('countdown'), { left: 240, running: false })
  assert.deepEqual(heard, [{ left: 300, running: true }, { left: 240, running: false }])
})

test('a window that opens later gets the values, but a replay never overrides a newer one', () => {
  resetShared()
  const sent = []
  connectShared(message => sent.push(message))
  setShared('a', 1)
  receiveShared({ type: 'shared-ask' })
  assert.deepEqual(sent.at(-1), { type: 'shared', name: 'a', value: 1, replay: true })
  receiveShared({ type: 'shared', name: 'a', value: 0, replay: true })
  assert.equal(getShared('a'), 1, 'what this window knows stays')
  receiveShared({ type: 'shared', name: 'b', value: 'x', replay: true })
  assert.equal(getShared('b'), 'x', 'an unknown name is filled in')
})

test('windows that only show the talk do not change shared state', () => {
  for (const view of ['preview', 'reader', 'follow']) {
    resetShared()
    setView(view)
    assert.equal(setShared('a', 1), false, view)
    assert.equal(getShared('a'), undefined)
  }
  resetShared()
  setView('audience')
  assert.equal(setShared('a', { when: new Date(0), skip: undefined }), true)
  assert.deepEqual(getShared('a'), { when: '1970-01-01T00:00:00.000Z' }, 'kept as the other windows get it')
})
