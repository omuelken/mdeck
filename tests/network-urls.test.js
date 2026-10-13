import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { currentUrls } from '../src/build/networkUrls.js'
import { homeMiddleware } from '../src/build/homePlugin.js'
import { createPairing } from '../src/build/pairing.js'

const server = (host = true) => ({ resolvedUrls: { local: ['http://localhost:4104/'], network: ['http://10.175.56.49:4104/'] }, config: { base: '/', server: { host } } })
const nic = address => ({ address, family: 'IPv4', internal: false })

test('the network addresses are read when asked, not when the server started', () => {
  let now = { en0: [nic('10.175.56.49')], en7: [nic('10.218.86.61')] }
  const urls = () => currentUrls(server(), { interfaces: () => now })
  assert.deepEqual(urls().network, ['http://10.175.56.49:4104/', 'http://10.218.86.61:4104/'])
  now = { en0: [nic('10.223.1.72')] }
  assert.deepEqual(urls().network, ['http://10.223.1.72:4104/'], 'the laptop moved to another network')
  now = { lo0: [{ address: '127.0.0.1', family: 'IPv4', internal: true }], en0: [nic('192.0.0.2'), { address: 'fe80::1', family: 'IPv6', internal: false }], en9: [nic('169.254.62.120')] }
  assert.deepEqual(urls().network, [], 'no address another device reaches')
  assert.equal(urls().exposed, true)
  assert.deepEqual(currentUrls(server('localhost'), { interfaces: () => now }).network, ['http://10.175.56.49:4104/'], 'without --network nothing changes')
})

test('a pairing code in no network says so instead of showing an address no one reaches', async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'mdeck-network-'))
  const deck = resolve(dir, 'talk.md')
  writeFileSync(deck, '---\ntheme: neue\n---\n\n# S\n')
  const pairing = createPairing()
  const call = (home, body) => new Promise(done => {
    const text = body ? JSON.stringify(body) : null
    const request = { url: body ? '/action' : '/info', method: body ? 'POST' : 'GET', headers: { host: 'localhost:4104', 'content-type': 'application/json' }, async *[Symbol.asyncIterator]() { if (text) yield Buffer.from(text) }, on(event, fn) { if (event === 'data' && text) fn(Buffer.from(text)); if (event === 'end') fn(); return this } }
    const response = { status: 200, setHeader() {}, writeHead(status) { this.status = status }, end(out) { done({ status: this.status, body: out ? JSON.parse(out) : null }) } }
    home(request, response, () => done({ status: 'next' }))
  })
  const offline = homeMiddleware(deck, { pairing, urls: () => ({ local: ['http://localhost:4104/'], network: [], exposed: true }) })
  const refused = await call(offline, { action: 'pair' })
  assert.equal(refused.status, 409)
  assert.match(refused.body.error, /no network/)
  assert.equal((await call(offline)).body.pairing.offline, true)
  const online = homeMiddleware(deck, { pairing, urls: () => ({ local: ['http://localhost:4104/'], network: ['http://10.223.1.72:4104/'], exposed: true }) })
  assert.equal(new URL((await call(online, { action: 'pair' })).body.url).host, '10.223.1.72:4104')
  assert.equal((await call(online)).body.pairing.offline, false)
})
