import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createRooms, createLimiter, clientAddress } from '../src/live/rooms.js'
import { startLiveServer } from '../src/live/server.js'
import { findRoomTag, roomsIn, roomsOnSlide, slideTitleFor } from '../src/live/roomTag.js'
import { sessionCode } from '../src/live/code.js'
import { parseSlides } from '../src/core/parseSlides.js'
import { validateDeck } from '../src/core/validateDeck.js'

const live = await startLiveServer({ port: 0, key: 'secret' })
after(() => live.close())
const post = (room, body, headers = {}) => fetch(`${live.url}/rooms/${room}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })

// Reads Server-Sent Events until `count` events arrived.
async function events(room, count, during = async () => {}) {
  const controller = new AbortController()
  const response = await fetch(`${live.url}/rooms/${room}/events`, { signal: controller.signal })
  assert.equal(response.headers.get('content-type'), 'text/event-stream; charset=utf-8')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const seen = []
  let buffer = '', started = false
  while (seen.length < count) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let end
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, end); buffer = buffer.slice(end + 2)
      const type = block.match(/^event: (.+)$/m)?.[1]
      if (type) seen.push({ type, data: JSON.parse(block.match(/^data: (.*)$/m)[1]) })
    }
    if (!started && seen.length) { started = true; await during() }
  }
  controller.abort()
  return seen
}

test('phones post, slides get a snapshot and then each new message', async () => {
  assert.equal((await post('deck.lunch', { from: 'phone-1', data: { vote: 'Thai' } })).status, 201)
  const seen = await events('deck.lunch', 3, async () => {
    await post('deck.lunch', { from: 'phone-2', data: { vote: 'Pizza' } })
    await post('deck.lunch', { from: 'phone-1', data: { vote: 'Mensa' } })
  })
  assert.equal(seen[0].type, 'snapshot')
  assert.deepEqual(seen[0].data.messages.map(m => m.data.vote), ['Thai'])
  assert.deepEqual(seen.slice(1).map(e => [e.type, e.data.from, e.data.data.vote]), [['message', 'phone-2', 'Pizza'], ['message', 'phone-1', 'Mensa']])
  assert.deepEqual(seen.slice(1).map(e => e.data.n), [2, 3])
})

test('only the key holder can reset a room, and listeners hear it', async () => {
  await post('deck.reset', { data: 1 })
  assert.equal((await fetch(`${live.url}/rooms/deck.reset/reset`, { method: 'POST' })).status, 403)
  assert.equal((await fetch(`${live.url}/rooms/deck.reset/reset`, { method: 'POST', headers: { Authorization: 'Bearer wrong!' } })).status, 403)
  const seen = await events('deck.reset', 2, () => fetch(`${live.url}/rooms/deck.reset/reset`, { method: 'POST', headers: { Authorization: 'Bearer secret' } }))
  assert.deepEqual(seen.map(e => e.type), ['snapshot', 'reset'])
  assert.deepEqual((await events('deck.reset', 1))[0].data.messages, [])
  assert.equal((await (await fetch(`${live.url}/info`, { headers: { Authorization: 'Bearer secret' } })).json()).canReset, true)
  assert.equal((await (await fetch(`${live.url}/info`)).json()).canReset, false)
})

test('only the presenter sets a room state, and listeners follow it', async () => {
  const set = (state, headers = {}) => fetch(`${live.url}/rooms/deck/state`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ state }) })
  assert.equal((await set({ room: 'evil' })).status, 403)
  assert.equal((await events('deck', 1))[0].data.state, null)
  const seen = await events('deck', 3, async () => {
    await set({ room: 'lunch' }, { Authorization: 'Bearer secret' })
    await set({ room: 'lunch' }, { Authorization: 'Bearer secret' })
    await set({ room: null }, { Authorization: 'Bearer secret' })
  })
  assert.deepEqual(seen.map(e => [e.type, e.data.state?.room ?? null]), [['snapshot', null], ['state', 'lunch'], ['state', null]], 'a repeated state is not passed on again')
  assert.deepEqual((await events('deck', 1))[0].data.state, { room: null })
})

test('bad requests are refused', async () => {
  assert.equal((await post('bad%20room', { data: 1 })).status, 400)
  assert.equal((await post('deck.x', { nothing: true })).status, 400)
  assert.equal((await post('deck.x', { data: 'x'.repeat(5000) })).status, 413)
  assert.equal((await fetch(`${live.url}/rooms/deck.x`, { method: 'POST', body: 'hi' })).status, 415)
  assert.equal((await fetch(`${live.url}/nope`)).status, 404)
  const preflight = await fetch(`${live.url}/rooms/deck.x`, { method: 'OPTIONS' })
  assert.equal(preflight.status, 204)
  assert.equal(preflight.headers.get('access-control-allow-origin'), '*')
})

test('the latest change wins over repeats from a screen changed earlier', () => {
  const rooms = createRooms()
  const heard = []
  rooms.subscribe('s', event => heard.push(event.state?.room))
  assert.equal(rooms.setState('s', { room: 'a', at: 0 }), true, 'a screen that just opened')
  assert.equal(rooms.setState('s', { room: 'b', at: 200 }), true, 'the presenter moves on')
  assert.equal(rooms.setState('s', { room: null, at: 100 }), false, 'a forgotten screen repeating an older slide')
  assert.equal(rooms.setState('s', { room: 'a', at: 0 }), false, 'a newly opened screen')
  assert.equal(rooms.setState('s', { room: 'b', at: 200 }), true, 'the presenter repeating itself')
  assert.equal(rooms.setState('s', { room: 'old' }), false, 'a page without `at` counts as the oldest')
  assert.equal(rooms.setState('s', { room: null, at: 300 }), true, 'someone moves the other screen on')
  assert.deepEqual(heard, ['a', 'b', null])
  assert.deepEqual(rooms.state('s'), { room: null, at: 300 })
})

test('rooms fill up, idle rooms are forgotten and senders are rate limited', () => {
  let t = 0
  const rooms = createRooms({ maxMessages: 2, maxRooms: 1, idleMs: 100, now: () => t })
  rooms.post('a', { data: 1 }); rooms.post('a', { data: 2 })
  assert.throws(() => rooms.post('a', { data: 3 }), { status: 429 })
  assert.throws(() => rooms.post('b', { data: 1 }), { status: 503 })
  t = 1000
  rooms.post('b', { data: 1 })
  assert.equal(rooms.size, 1)
  const limit = createLimiter({ burst: 2, perMs: 1000, now: () => t })
  assert.deepEqual([limit('x'), limit('x'), limit('x'), limit('y')], [true, true, false, true])
  t += 500
  assert.equal(limit('x'), true)
  assert.equal(clientAddress({ socket: { remoteAddress: '127.0.0.1' }, headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' } }), '203.0.113.9')
  assert.equal(clientAddress({ socket: { remoteAddress: '198.51.100.2' }, headers: { 'x-forwarded-for': '203.0.113.9' } }), '198.51.100.2')
})

test('the answer page finds the component by its room', () => {
  const source = '# Q\n\n<poll room="lunch" question="Where?" options="A|B" />\n\n<quiz room=\'q1\'>What is 2+2?</quiz>\n'
  assert.equal(findRoomTag(source, 'lunch'), '<poll room="lunch" question="Where?" options="A|B" />')
  assert.equal(findRoomTag(source, 'q1'), "<quiz room='q1'>What is 2+2?</quiz>")
  assert.equal(findRoomTag(source, 'lun'), null)
  assert.equal(findRoomTag(source, 'a.b'), null)
  assert.deepEqual(roomsIn(source), [{ tag: 'poll', room: 'lunch' }, { tag: 'quiz', room: 'q1' }])
  const deck = parseSlides('---\ndesign: neue\n---\n\n---\ntitle: Outline name\n---\n# On screen\n\n<poll room="a" options="x|y" />\n\n---\n# Plain\n')
  assert.deepEqual(deck.slides.map(roomsOnSlide), [['a'], []])
  assert.equal(slideTitleFor(deck, 'a'), 'On screen', 'phones see the heading the audience saw')
  const shown = '# Syntax\n\n```markdown\n<poll room="a" options="x|y" />\n```\n\nOr inline: `<poll room="b" />`\n\n<poll room="a" options="real|one" />\n'
  assert.deepEqual(roomsIn(shown), [{ tag: 'poll', room: 'a' }], 'code is not an activity')
  assert.equal(findRoomTag(shown, 'a'), '<poll room="a" options="real|one" />')
})

test('live settings are validated', () => {
  const codes = config => validateDeck(parseSlides(`---\n${config}\n---\n\n---\n# A\n`)).map(d => d.code)
  assert.deepEqual(codes('live:\n  server: https://example.org/live\n  id: talk\n  code: 482113'), [])
  assert.deepEqual(codes('live:\n  server: example.org'), ['invalid-config'])
  assert.deepEqual(codes('live:\n  code: 12'), ['invalid-config'])
  assert.deepEqual(codes('live:\n  audience: https://example.org/slides/'), ['invalid-config'], 'the old hosted-deck setting says it is gone')
  assert.deepEqual(codes('live: yes'), ['invalid-config'])
})

test("a deck's session code is six stable digits, unless it sets one", () => {
  const a = sessionCode({ meta: { title: 'Ask the room' } })
  assert.match(a, /^[1-9]\d{5}$/)
  assert.equal(sessionCode({ meta: { title: 'Ask the room' } }), a)
  assert.equal(sessionCode({ meta: { title: 'Ask the room' }, live: { id: 'ask-the-room' } }), a, 'live.id and the title give the same name')
  assert.notEqual(sessionCode({ meta: { title: 'Another talk' } }), a)
  assert.equal(sessionCode({ live: { code: 4711 } }), '4711')
})

test("the room server serves the phones' answer page at /<code>", async () => {
  const pageResponse = await fetch(`${live.url}/482113`)
  assert.equal(pageResponse.status, 200)
  assert.match(pageResponse.headers.get('content-type'), /text\/html/)
  const html = await pageResponse.text()
  assert.match(html, /answer\.js/)
  for (const [file, type] of [['answer.js', /javascript/], ['answer.css', /css/]]) {
    const response = await fetch(`${live.url}/${file}`)
    assert.equal(response.status, 200, file)
    assert.match(response.headers.get('content-type'), type)
  }
  assert.equal((await fetch(`${live.url}/12`)).status, 404, 'too short to be a code')
})

test("the presenter's state may carry a whole activity and look", async () => {
  const state = { room: 'q', activity: { type: 'choice', question: 'Q?', options: Array.from({ length: 20 }, (_, i) => `Option ${i}`) }, look: { tokens: Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`--t${i}`, 'x'.repeat(60)])) }, labels: { waiting: 'w'.repeat(200) } }
  const response = await fetch(`${live.url}/rooms/482113/state`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer secret' }, body: JSON.stringify({ state }) })
  assert.equal(response.status, 200)
  assert.equal((await events('482113', 1))[0].data.state.activity.options.length, 20)
})

test('states from named screens are ordered by when the server heard them, not by their clocks', () => {
  let t = 1000
  const rooms = createRooms({ now: () => t })
  // The iPad's clock is a minute behind the laptop's.
  assert.equal(rooms.setState('s', { index: 1, screen: 'laptop', at: 90000 }), true)
  t += 5000
  assert.equal(rooms.setState('s', { index: 2, screen: 'ipad', at: 30000 }), true, 'a later change from a slow clock still wins')
  t += 4000
  assert.equal(rooms.setState('s', { index: 1, screen: 'laptop', at: 90000 }), false, 'the laptop repeating its older change')
  assert.equal(rooms.setState('s', { index: 0, screen: 'new-tab', at: 0 }), false, 'a screen that just opened')
  t += 1000
  assert.equal(rooms.setState('s', { index: 3, screen: 'laptop', at: 95000 }), true, 'the laptop moves on')
  assert.equal(rooms.state('s').index, 3)
})

test('only the presenter relays ink; listeners get it at once and late ones get the changes', async () => {
  const relay = (messages, headers = {}) => fetch(`${live.url}/rooms/deck.stage/ink`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ messages }) })
  const op = { type: 'op', key: 'a:op', op: { type: 'add', slideId: 's', stroke: { id: 'a:1', points: [[1, 2, 0.5]] } } }
  assert.equal((await relay([op])).status, 403)
  const reply = await relay([op], { Authorization: 'Bearer secret' })
  assert.deepEqual(await reply.json(), { ok: true, listeners: 0 })
  const segment = { type: 'segment', key: 'a:2', slideId: 's', from: 0, points: [[3, 4, 0.5]] }
  const seen = await events('deck.stage', 2, () => relay([segment], { Authorization: 'Bearer secret' }))
  assert.deepEqual(seen[0].data.ink, [op], 'the snapshot has the changes, not the strokes in progress')
  assert.deepEqual(seen[1], { type: 'ink', data: { messages: [segment] } })
  assert.equal((await relay(Array.from({ length: 101 }, () => segment), { Authorization: 'Bearer secret' })).status, 400)
})
