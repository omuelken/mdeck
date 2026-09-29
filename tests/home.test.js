import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, request } from 'node:http'
import { mkdtempSync, copyFileSync, cpSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { homeMiddleware, outputsFor } from '../src/build/homePlugin.js'

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

test('info describes the deck, its check results, building blocks and addresses', async () => {
  const response = await get('/info')
  assert.equal(response.status, 200)
  const info = await response.json()
  assert.equal(info.name, 'talk.md')
  assert.ok(info.slides > 0)
  assert.deepEqual(info.diagnostics.filter(d => d.severity === 'error'), [])
  assert.ok(info.layouts.some(layout => layout.id === 'comparison' && layout.source !== 'built-in'))
  assert.ok(info.layouts.every(layout => layout.starter.length > 0))
  assert.deepEqual(info.components.find(c => c.tag === 'chart'), { tag: 'chart', source: 'deck', folder: 'components', example: '<chart />' })
  assert.equal(info.urls.network, 'http://192.168.1.20:5173/')
  assert.match(info.phoneQr, /^<svg/)
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
