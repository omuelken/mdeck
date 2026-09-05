import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import preact from '@preact/preset-vite'
import { createServer as createHttpServer } from 'node:http'
import { mkdtempSync, copyFileSync, readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { slidesPlugin } from '../src/build/slidesPlugin.js'
import { editorPlugin, createDeckFile, isAllowedRequest, hashSource } from '../src/build/editorPlugin.js'

const dir = mkdtempSync(resolve(tmpdir(), 'mdeck-editor-'))
cpSync(new URL('../examples/custom-templates/extensions', import.meta.url), resolve(dir, 'extensions'), { recursive: true })
const deck = resolve(dir, 'slides.md')
copyFileSync(new URL('../examples/custom-templates/slides.md', import.meta.url), deck)
const original = readFileSync(deck, 'utf8')

const vite = await createServer({ configFile: false, root: resolve('src/runtime'), plugins: [preact(), slidesPlugin(deck, { editor: true }), editorPlugin(deck)], server: { middlewareMode: true, hmr: { server: createHttpServer() }, fs: { allow: [process.cwd(), dir] } }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
const http = createHttpServer(vite.middlewares)
await new Promise(done => http.listen(0, '127.0.0.1', done))
const base = `http://127.0.0.1:${http.address().port}`
after(async () => { http.close(); await vite.close() })

const api = (path, { headers, ...options } = {}) => fetch(base + '/__mdeck' + path, { ...options, headers: { 'Content-Type': 'application/json', ...(headers ?? {}) } })
const post = (body, headers) => api('/source', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers })

test('GET /deck returns the file, its hash and the extension registry', async () => {
  const response = await api('/deck')
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const body = await response.json()
  assert.equal(body.source, original)
  assert.equal(body.hash, hashSource(original))
  assert.equal(body.name, 'slides.md')
  assert.ok(body.registry.templates.find(t => t.id === 'split')?.starter.includes('layout: split'))
  assert.ok(body.registry.templates.find(t => t.id === 'comparison'))
  assert.ok(body.registry.themes.find(t => t.id === 'neue')?.tokens['--accent'])
  assert.deepEqual(body.warnings, [])
})

test('POST /source writes on a matching base and rejects stale writes with the current file', async () => {
  const edited = original.replace('# Deployment options', '# Deployment choices')
  const ok = await post({ source: edited, base: hashSource(original) })
  assert.equal(ok.status, 200)
  const { hash } = await ok.json()
  assert.equal(hash, hashSource(edited))
  assert.equal(readFileSync(deck, 'utf8'), edited)
  const stale = await post({ source: original, base: hashSource(original) })
  assert.equal(stale.status, 409)
  const conflict = await stale.json()
  assert.equal(conflict.error, 'conflict')
  assert.equal(conflict.source, edited)
  assert.equal(conflict.hash, hash)
  assert.equal(readFileSync(deck, 'utf8'), edited)
  const restore = await post({ source: original, base: hash })
  assert.equal(restore.status, 200)
  assert.equal(readFileSync(deck, 'utf8'), original)
})

test('bad requests are refused without touching the file', async () => {
  assert.equal((await post({ source: 'x', base: 'y' }, { Origin: 'http://evil.test' })).status, 403)
  assert.equal((await api('/deck', { headers: { Origin: 'http://evil.test' } })).status, 403)
  assert.equal((await post({ source: 'x', base: 'y' }, { Origin: base })).status, 409)
  assert.equal((await post('{"source":"x","base":"y"}', { 'Content-Type': 'text/plain' })).status, 415)
  assert.equal((await post('{ nope')).status, 400)
  assert.equal((await post({ source: 5, base: 'y' })).status, 400)
  assert.equal((await api('/source')).status, 405)
  assert.equal((await api('/nothing')).status, 404)
  assert.equal(readFileSync(deck, 'utf8'), original)
})

test('a broken deck is still saved and still loads in editor mode', async () => {
  const broken = original + '\n---\n:::slot left\nunclosed\n'
  const response = await post({ source: broken, base: hashSource(original) })
  assert.equal(response.status, 200)
  assert.equal(readFileSync(deck, 'utf8'), broken)
  const mod = await vite.ssrLoadModule('virtual:slides')
  assert.equal(mod.default, broken)
  await post({ source: original, base: hashSource(broken) })
})

test('the deck file tracks its own writes so only external changes are reported', () => {
  const file = createDeckFile(deck)
  assert.equal(file.isExternalChange(original), true)
  const result = file.write(original + '\n', hashSource(original))
  assert.equal(result.ok, true)
  assert.equal(file.isExternalChange(original + '\n'), false)
  writeFileSync(deck, original)
  assert.equal(file.isExternalChange(original), true)
  assert.deepEqual(file.write('x', 'stale'), { ok: false, conflict: true, source: original, hash: hashSource(original) })
  assert.equal(createDeckFile(resolve(dir, 'missing.md')).write('x', 'y').conflict, true)
})

test('only same-host loopback requests are allowed', () => {
  const request = headers => ({ headers })
  assert.equal(isAllowedRequest(request({ host: '127.0.0.1:5173' })), true)
  assert.equal(isAllowedRequest(request({ host: 'localhost:5173', origin: 'http://localhost:5173' })), true)
  assert.equal(isAllowedRequest(request({ host: '[::1]:5173' })), true)
  assert.equal(isAllowedRequest(request({ host: '127.0.0.1:5173', origin: 'http://127.0.0.1:5174' })), false)
  assert.equal(isAllowedRequest(request({ host: '127.0.0.1:5173', origin: 'null' })), false)
  assert.equal(isAllowedRequest(request({ host: 'example.com' })), false)
  assert.equal(isAllowedRequest(request({})), false)
})
