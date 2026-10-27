import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { startLiveServer } from '../src/live/server.js'
import { createRooms } from '../src/live/rooms.js'
import { checkServer } from '../src/live/check.js'
import { parseArgs } from '../src/cli/args.js'

const keyed = await startLiveServer({ port: 0, key: 'secret' })
const open = await startLiveServer({ port: 0 })
after(() => Promise.all([keyed.close(), open.close()]))
const get = (live, path, headers = {}, init = {}) => fetch(`${live.url}${path}`, { headers, redirect: 'manual', ...init })

test('/ says what the server is and how a deck uses it', async () => {
  const response = await get(keyed, '/')
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type'), /^text\/html/)
  assert.match(response.headers.get('content-security-policy'), /default-src 'none'/)
  const html = await response.text()
  assert.match(html, /Running · version \d+\.\d+\.\d+/)
  assert.match(html, new RegExp(`server: http://${new URL(keyed.url).host}`))
  assert.doesNotMatch(html, /secret/, 'the key is nowhere on the page')
  // Behind a proxy on this machine, the visitor's host and protocol are the ones to put in a deck.
  const proxied = await (await get(keyed, '/', { 'X-Forwarded-Host': 'slides.example.org', 'X-Forwarded-Proto': 'https' })).text()
  assert.match(proxied, /server: https:\/\/slides\.example\.org/)
  assert.equal((await get(keyed, '/', {}, { method: 'HEAD' })).status, 200)
})

test('a host that is HTML is not taken for HTML', async () => {
  const html = await (await get(keyed, '/', { 'X-Forwarded-Host': '"><script>alert(1)</script>' })).text()
  assert.doesNotMatch(html, /<script>alert/)
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
})

test('a join code typed on the page leads to the phones\' answer page', async () => {
  const response = await get(keyed, '/?code=482113')
  assert.equal(response.status, 302)
  assert.equal(response.headers.get('location'), '/482113')
  assert.equal((await get(keyed, '/482113')).status, 200)
  const wrong = await get(keyed, '/?code=12ab')
  assert.equal(wrong.status, 200)
  assert.match(await wrong.text(), /A join code has 4 to 8 digits/)
})

test('/health answers monitors without saying anything', async () => {
  for (const live of [keyed, open]) {
    const response = await get(live, '/health')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'ok\n')
    assert.equal(response.headers.get('cache-control'), 'no-store')
  }
  assert.equal((await get(keyed, '/health', {}, { method: 'POST' })).status, 404)
})

test('/status is for whoever knows the key, and does not exist without one', async () => {
  assert.equal((await get(keyed, '/status')).status, 401)
  assert.equal((await get(keyed, '/status', { Authorization: 'Bearer wrong' })).status, 401)
  assert.equal((await get(open, '/status', { Authorization: 'Bearer secret' })).status, 404)
  await fetch(`${keyed.url}/rooms/482113.poll`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: 'phone', data: { value: 'a secret answer' } }) })
  const response = await get(keyed, '/status', { Authorization: 'Bearer secret' })
  assert.equal(response.status, 200)
  const status = await response.json()
  assert.equal(status.rooms, 1)
  assert.equal(status.messages, 1)
  assert.deepEqual(status.list.map(room => room.room), ['482113.poll'])
  assert.deepEqual(status.relay, { enabled: true, tunnels: 0 })
  assert.equal(status.limits.rooms, 500)
  assert.doesNotMatch(JSON.stringify(status), /a secret answer|phone/, 'counts, never answers')
})

test('wrong keys are limited', async () => {
  const live = await startLiveServer({ port: 0, key: 'another' })
  try {
    const statuses = []
    for (let i = 0; i < 12; i++) statuses.push((await get(live, '/status', { Authorization: 'Bearer nope' })).status)
    assert.deepEqual(statuses.slice(0, 10), Array(10).fill(401))
    assert.equal(statuses[11], 429)
    assert.equal((await get(live, '/status', { Authorization: 'Bearer another' })).status, 429, 'also for the right key until the minute is over')
  } finally { await live.close() }
})

test('rooms say what they hold for the operator', () => {
  let time = 1000
  const rooms = createRooms({ now: () => time, maxRooms: 7 })
  rooms.post('a', { from: 'x', data: { value: 1 } })
  time += 5000
  rooms.post('b', { from: 'x', data: { value: 1 } })
  rooms.post('b', { from: 'y', data: { value: 2 } })
  const stats = rooms.stats()
  assert.deepEqual([stats.rooms, stats.messages, stats.listeners, stats.pictures], [2, 3, 0, 0])
  assert.deepEqual(stats.list.map(room => [room.room, room.messages, room.idleSeconds]), [['b', 2, 0], ['a', 1, 5]], 'the busiest in time first')
  assert.deepEqual(stats.limits, { rooms: 7, messagesPerRoom: 5000, idleHours: 12 })
})

test('--check says what is right with a server, and with a key tries presenting through it', async () => {
  const withKey = await checkServer(keyed.url, { key: 'secret' })
  assert.deepEqual(withKey.map(result => result.status), ['ok', 'ok', 'ok', 'ok', 'ok'])
  assert.match(withKey.at(-1).detail, /mdeck run --server works/)
  const noKey = await checkServer(keyed.url)
  assert.equal(noKey.at(-1).status, 'ok')
  assert.match(noKey.at(-1).detail, /MDECK_SERVER_KEY/)
  const wrongKey = await checkServer(keyed.url, { key: 'other' })
  assert.equal(wrongKey.at(-1).status, 'fail')
  assert.match(wrongKey.at(-1).detail, /refuses the key/)
  const unlocked = await checkServer(open.url, { key: 'secret' })
  assert.equal(unlocked.at(-1).status, 'warn')
  assert.match(unlocked.at(-1).detail, /no key set/)
})

test('--check finds what a web server in front of it gets wrong', async () => {
  // A proxy that answers every upgrade as an ordinary request, drops the CORS
  // header and holds the event stream back.
  const proxy = createServer((request, response) => {
    if (request.url.includes('/events')) { response.writeHead(200, { 'Content-Type': 'text/event-stream' }); return }
    if (request.url === '/info') { response.writeHead(200, { 'Content-Type': 'application/json' }); return response.end(JSON.stringify({ version: '0.0.1' })) }
    response.writeHead(404, { 'Content-Type': 'application/json' }); response.end('{"error":"Not found"}')
  })
  await new Promise(done => proxy.listen(0, '127.0.0.1', done))
  try {
    const results = await checkServer(`http://127.0.0.1:${proxy.address().port}`, { key: 'secret', timeoutMs: 800 })
    assert.deepEqual(results.map(result => result.status), ['ok', 'warn', 'fail', 'fail', 'fail'])
    assert.match(results[1].detail, /the server runs 0\.0\.1/)
    assert.match(results[2].detail, /Access-Control-Allow-Origin/)
    assert.match(results[3].detail, /proxy_buffering off/)
    assert.match(results[4].detail, /proxy_set_header Upgrade/)
  } finally { proxy.closeAllConnections(); proxy.close() }
  assert.equal((await checkServer('http://127.0.0.1:1', { timeoutMs: 500 }))[0].status, 'fail')
})

test('--check names a server by its address, and starts no server', () => {
  assert.equal(parseArgs('server', ['--check', 'https://slides.example.org']).options['--check'], 'https://slides.example.org')
  assert.equal(parseArgs('server', ['--check']).options['--check'], null)
  for (const args of [['--check', 'slides.example.org'], ['--check', 'https://x.org/path'], ['--check', 'https://x.org', '--port', '8000']]) assert.throws(() => parseArgs('server', args), /--check/, args.join(' '))
})

test('a key is easy to guess when it is short or repeats a few characters', async () => {
  const { weakKeyReason } = await import('../src/live/rooms.js')
  for (const weak of ['123', 'secret', 'choose-a-secret', 'aaaaaaaaaaaaaaaaaaaa', '1212121212121212']) assert.ok(weakKeyReason(weak), weak)
  for (const fine of ['9f3a6c1e0b7d44c2a85e1f90', 'correct-horse-battery-staple']) assert.equal(weakKeyReason(fine), null, fine)
})

test('wrong keys are counted per address, and only where a key was sent', async () => {
  const { createKeyGuard } = await import('../src/live/rooms.js')
  let time = 0
  const guard = createKeyGuard({ burst: 3, perMs: 1000, now: () => time })
  const request = { socket: { remoteAddress: '10.0.0.1' }, headers: {} }
  const other = { socket: { remoteAddress: '10.0.0.2' }, headers: {} }
  for (let i = 0; i < 2; i++) guard.failed(request)
  assert.equal(guard.blocked(request), false)
  guard.failed(request)
  assert.equal(guard.blocked(request), true)
  assert.equal(guard.blocked(other), false, 'another address is not affected')
  time = 1000
  assert.equal(guard.blocked(request), false, 'the window is over')
})

test('after too many wrong keys an address is refused, also with the right one', async () => {
  const live = await startLiveServer({ port: 0, key: 'a-long-random-key-for-this-test' })
  const reset = key => fetch(`${live.url}/rooms/482113.poll/reset`, { method: 'POST', headers: { Authorization: `Bearer ${key}` } })
  try {
    assert.equal((await reset('a-long-random-key-for-this-test')).status, 200)
    for (let i = 0; i < 30; i++) assert.equal((await reset('wrong')).status, 403)
    assert.equal((await reset('a-long-random-key-for-this-test')).status, 403, 'blocked')
    // /info only says whether the sender may; it does not count and is not refused.
    assert.equal((await (await fetch(`${live.url}/info`, { headers: { Authorization: 'Bearer wrong' } })).json()).canReset, false)
    // The tunnel is refused for the same address, and --check says why.
    const results = await checkServer(live.url, { key: 'a-long-random-key-for-this-test' })
    assert.equal(results.at(-1).status, 'warn')
    assert.match(results.at(-1).detail, /too many wrong keys/)
  } finally { await live.close() }
})

test('phones, which send no key, never count against an address', async () => {
  const live = await startLiveServer({ port: 0, key: 'a-long-random-key-for-this-test' })
  try {
    for (let i = 0; i < 40; i++) assert.equal((await fetch(`${live.url}/rooms/482113.poll/reset`, { method: 'POST' })).status, 403)
    assert.equal((await fetch(`${live.url}/rooms/482113.poll/reset`, { method: 'POST', headers: { Authorization: 'Bearer a-long-random-key-for-this-test' } })).status, 200)
  } finally { await live.close() }
})
