import test from 'node:test'
import assert from 'node:assert/strict'
import { reactionsOf, reactionsProblem, DEFAULT_REACTIONS } from '../src/core/reactions.js'
import { createRooms, liveHandler } from '../src/live/rooms.js'
import { parseSlides } from '../src/core/parseSlides.js'
import { validateDeck } from '../src/core/validateDeck.js'

test('reactions: true offers the usual set, a list its own, anything else none', () => {
  assert.deepEqual(reactionsOf({ reactions: true }), DEFAULT_REACTIONS)
  assert.deepEqual(reactionsOf({ reactions: ['👍', ' 🐢 ', '👍', 'louder'] }), ['👍', '🐢', 'louder'])
  assert.equal(reactionsOf({}), null)
  assert.equal(reactionsOf({ reactions: false }), null)
  assert.equal(reactionsProblem(['👍']), null)
  assert.match(reactionsProblem('👍'), /reactions must be/)
  assert.match(reactionsProblem(['a much too long reaction']), /up to 16 characters/)
  assert.match(reactionsProblem(Array(9).fill('👍')), /1 to 8/)
})

test('a deck with reactions is checked, and keeps the setting', () => {
  const good = parseSlides('---\nreactions: [👍, 🐢]\n---\n\n---\n# One\n')
  assert.deepEqual(good.deckConfig.reactions, ['👍', '🐢'])
  assert.equal(validateDeck(good).filter(d => d.severity === 'error').length, 0)
  const bad = parseSlides('---\nreactions: lots\n---\n\n---\n# One\n')
  assert.ok(validateDeck(bad).some(d => /reactions must be/.test(d.message)))
})

test('the server passes reactions on without keeping them, with a limit of their own', async () => {
  const rooms = createRooms()
  const heard = []
  rooms.subscribe('123456.reactions', event => heard.push(event))
  rooms.post('123456.reactions', { from: 'a', data: { value: '👍' } })
  assert.equal(heard[0].message.data.value, '👍')
  assert.deepEqual(rooms.snapshot('123456.reactions'), [], 'nothing is kept')

  let answersLeft = 0
  const handler = liveHandler({ rooms, limit: () => (answersLeft--, true), reactionLimit: () => true })
  const call = (id, body) => new Promise(done => {
    const request = { url: `/rooms/${id}`, method: 'POST', headers: { 'content-type': 'application/json' }, socket: { remoteAddress: '10.0.0.1' }, on(event, handler) {
      if (event === 'data') handler(Buffer.from(JSON.stringify(body)))
      if (event === 'end') handler()
      return this
    } }
    const response = { setHeader() {}, writeHead(status) { this.status = status }, end(text) { done({ status: this.status, body: JSON.parse(text) }) } }
    handler(request, response)
  })
  assert.equal((await call('123456.reactions', { from: 'a', data: { value: '🐢' } })).status, 201)
  assert.equal(answersLeft, 0, 'a reaction uses up no answers')
  assert.equal((await call('123456.reactions', { from: 'a', data: { value: { evil: 1 } } })).status, 400)
  assert.equal((await call('123456.lunch', { from: 'a', data: { value: 'Thai' } })).status, 201)
  assert.equal(answersLeft, -1)
})
