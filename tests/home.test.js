import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, request } from 'node:http'
import { mkdtempSync, copyFileSync, cpSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { homeMiddleware, outputsFor, liveStatus } from '../src/build/homePlugin.js'

const dir = mkdtempSync(resolve(tmpdir(), 'mdeck-home-'))
cpSync(new URL('../examples/custom-templates/extensions', import.meta.url), resolve(dir, 'extensions'), { recursive: true })
const deck = resolve(dir, 'talk.md')
copyFileSync(new URL('../examples/custom-templates/slides.md', import.meta.url), deck)
mkdirSync(resolve(dir, 'components'))
writeFileSync(resolve(dir, 'components', 'Chart.jsx'), 'export default () => null\n')

const runs = [], revealed = []
let editorStarts = 0
const handler = homeMiddleware(deck, {
  urls: () => ({ local: ['http://localhost:5173/'], network: ['http://192.168.1.20:5173/'] }),
  services: { editor: async () => ({ url: `http://127.0.0.1:5183/editor.html#${++editorStarts}` }) },
  run: async (args, cwd) => { runs.push({ args, cwd }); return args.includes('--share') ? { code: 1, output: 'boom' } : { code: 0, output: 'ok' } },
  open: file => revealed.push(file),
})
const http = createServer((request, response) => handler(request, response, () => { response.writeHead(404); response.end() }))
await new Promise(done => http.listen(0, '127.0.0.1', done))
const base = `http://127.0.0.1:${http.address().port}`
after(() => http.close())

const get = (path, headers) => fetch(base + path, { headers })
const act = body => fetch(base + '/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

test('info describes the deck, its check results and addresses', async () => {
  const response = await get('/info')
  assert.equal(response.status, 200)
  const info = await response.json()
  assert.equal(info.name, 'talk.md')
  assert.ok(info.slides > 0)
  assert.deepEqual(info.diagnostics.filter(d => d.severity === 'error'), [])
  assert.equal(info.live, null, 'no live section without live.server')
  assert.deepEqual(Object.keys(info.outputs), ['folder', 'share', 'pdf'])
  assert.equal(info.services.editor, null)
})

test('missing pictures show up as check errors', async () => {
  writeFileSync(deck, '---\ndesign: neue\n---\n\n---\n# Hi\n\n![](./img/missing.png)\n')
  const info = await (await get('/info')).json()
  assert.deepEqual(info.diagnostics.map(d => d.code), ['missing-asset'])
  copyFileSync(new URL('../examples/custom-templates/slides.md', import.meta.url), deck)
})

test('services start once and report their address', async () => {
  const first = await (await act({ action: 'editor' })).json()
  const second = await (await act({ action: 'editor' })).json()
  assert.equal(first.url, second.url)
  assert.equal(editorStarts, 1)
  assert.equal((await (await get('/info')).json()).services.editor, first.url)
})

test('builds run the CLI beside the deck and keep their result', async () => {
  const done = await (await act({ action: 'build', output: 'pdf' })).json()
  assert.equal(done.status, 'done')
  assert.deepEqual(runs.at(-1), { args: outputsFor(deck).pdf.args, cwd: dir })
  const failed = await (await act({ action: 'build', output: 'share' })).json()
  assert.equal(failed.status, 'failed')
  assert.equal(failed.log, 'boom')
  const info = await (await get('/info')).json()
  assert.equal(info.outputs.pdf.status, 'done')
  assert.equal(info.outputs.share.status, 'failed')
  assert.equal((await act({ action: 'build', output: 'nope' })).status, 400)
})

test('reveal only opens known files that exist', async () => {
  assert.equal((await act({ action: 'reveal', output: 'deck' })).status, 200)
  assert.deepEqual(revealed, [deck])
  assert.equal((await act({ action: 'reveal', output: 'pdf' })).status, 404)
  assert.equal((await act({ action: 'reveal', output: '../../etc/passwd' })).status, 404)
  assert.equal((await act({ action: 'rm -rf' })).status, 400)
})

test('requests from other hosts or pages are refused', async () => {
  // fetch() cannot set Host, so send this one by hand.
  const status = await new Promise((done, fail) => request(base + '/info', { headers: { Host: '192.168.1.20:5173' } }, response => { response.resume(); done(response.statusCode) }).on('error', fail).end())
  assert.equal(status, 403)
  assert.equal((await get('/info', { Origin: 'http://evil.example' })).status, 403)
  assert.equal((await fetch(base + '/info', { method: 'POST' })).status, 405)
})

test('a deck with a room server shows its health, the viewer link and the presenter code', async () => {
  const liveDeck = resolve(dir, 'live.md')
  writeFileSync(liveDeck, '---\ndesign: neue\nlive:\n  server: https://example.org/live/\n  audience: https://example.org/slides/talk/\n---\n\n---\n# Q\n\n<poll room="q" options="a|b" />\n')
  const asked = []
  const roomServer = async (url, { headers }) => { asked.push([url, headers.Authorization]); return { ok: true, json: async () => ({ canReset: headers.Authorization === 'Bearer s3cret' }) } }
  const handler = homeMiddleware(liveDeck, { liveKey: 's3cret', fetch: roomServer, urls: () => ({ local: ['http://localhost:5173/'], network: [] }) })
  const reply = await new Promise(done => {
    const response = { headers: {}, setHeader() {}, writeHead(status) { this.status = status }, end(body) { done({ status: this.status, body: JSON.parse(body) }) } }
    handler({ url: '/info', method: 'GET', headers: { host: 'localhost:5173' } }, response, () => {})
  })
  assert.equal(reply.status, 200)
  const { live } = reply.body
  assert.deepEqual(asked, [['https://example.org/live/info', 'Bearer s3cret']])
  assert.equal(live.server, 'https://example.org/live/')
  assert.equal(live.reachable, true)
  assert.equal(live.keyAccepted, true)
  assert.equal(live.key, 's3cret')
  assert.equal(live.viewerUrl, 'https://example.org/slides/talk/?view=respond')
  assert.equal(live.viewerReachable, true)
  assert.equal(live.hostedPresenterUrl, 'https://example.org/slides/talk/?view=presenter&livekey=s3cret')
  const plain = resolve(dir, 'plain-live.md')
  writeFileSync(plain, '---\ndesign: neue\nlive:\n  server: https://example.org/live\n---\n\n---\n# Q\n')
  const viaProxy = await new Promise(done => homeMiddleware(plain, { fetch: roomServer, urls: () => ({ local: ['http://localhost:4104/'], network: [] }) })({ url: '/info', method: 'GET', headers: { host: 'deck.localhost:7777' } }, { setHeader() {}, writeHead() {}, end: body => done(JSON.parse(body).live) }, () => {}))
  assert.equal(viaProxy.viewerUrl, 'http://deck.localhost:7777/?view=respond', 'the address the page was opened with')
  assert.equal(viaProxy.viewerReachable, false)
  assert.equal(viaProxy.key, null)
})

test('room server problems are reported, not thrown', async () => {
  const down = async () => { throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } }) }
  assert.deepEqual(await liveStatus({ server: 'http://127.0.0.1:1' }, { fetch: down }), { reachable: false, error: 'ECONNREFUSED' })
  const wrong = async () => ({ ok: false, status: 404 })
  assert.deepEqual(await liveStatus({ server: 'http://x' }, { fetch: wrong }), { reachable: false, error: 'It answered with status 404' })
  const noKey = async () => ({ ok: true, json: async () => ({ canReset: false }) })
  assert.equal((await liveStatus({ server: 'http://x' }, { fetch: noKey })).keyAccepted, null, 'without a code there is nothing to accept')
})
