import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import preact from '@preact/preset-vite'
import { createServer as createHttpServer } from 'node:http'
import { mkdtempSync, copyFileSync, readFileSync, writeFileSync, cpSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { slidesPlugin } from '../src/build/slidesPlugin.js'
import { editorPlugin, createDeckFile, backupDeck, isAllowedRequest, hashSource, BACKUP_DIR } from '../src/build/editorPlugin.js'

const dir = mkdtempSync(resolve(tmpdir(), 'mdeck-editor-'))
cpSync(new URL('../examples/custom-layouts/extensions', import.meta.url), resolve(dir, 'extensions'), { recursive: true })
const deck = resolve(dir, 'slides.md')
copyFileSync(new URL('../examples/custom-layouts/slides.md', import.meta.url), deck)
const original = readFileSync(deck, 'utf8')

// Own Vite cache per test file, as in render.test.js.
const vite = await createServer({ configFile: false, root: resolve('src/runtime'), plugins: [preact(), slidesPlugin(deck, { editor: true }), editorPlugin(deck)], server: { middlewareMode: true, hmr: { server: createHttpServer() }, fs: { allow: [process.cwd(), dir] } }, optimizeDeps: { noDiscovery: true, include: [] }, cacheDir: mkdtempSync(resolve(tmpdir(), 'mdeck-vite-cache-')), appType: 'custom' })
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
  assert.ok(body.registry.layouts.find(t => t.id === 'split')?.starter.includes('layout: split'))
  assert.ok(body.registry.layouts.find(t => t.id === 'comparison'))
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

test('the first write of a session backs up the file and old copies are pruned', () => {
  const folder = mkdtempSync(resolve(tmpdir(), 'mdeck-backup-'))
  const path = resolve(folder, 'talk.md')
  writeFileSync(path, 'one')
  const file = createDeckFile(path)
  assert.equal(file.write('one', hashSource('one')).ok, true)
  assert.equal(file.backupFile, null, 'an unchanged write needs no copy')
  file.write('two', hashSource('one'))
  file.write('three', hashSource('two'))
  assert.equal(readFileSync(file.backupFile, 'utf8'), 'one')
  assert.deepEqual(readdirSync(resolve(folder, BACKUP_DIR)).length, 1)
  for (let i = 0; i < 12; i++) backupDeck(path, `copy ${i}`, new Date(Date.UTC(2026, 0, 1, 0, 0, i)))
  writeFileSync(resolve(folder, BACKUP_DIR, 'other-2020-01-01T00-00-00Z.md'), 'other deck')
  const copies = readdirSync(resolve(folder, BACKUP_DIR)).filter(name => name.startsWith('talk-')).sort()
  assert.equal(copies.length, 10)
  assert.equal(readFileSync(resolve(folder, BACKUP_DIR, copies.at(-1)), 'utf8'), 'one', 'the newest copy survives')
  assert.ok(existsSync(resolve(folder, BACKUP_DIR, 'other-2020-01-01T00-00-00Z.md')), 'other decks are untouched')
})

test('only same-host loopback requests are allowed', () => {
  const request = headers => ({ headers })
  assert.equal(isAllowedRequest(request({ host: '127.0.0.1:5173' })), true)
  assert.equal(isAllowedRequest(request({ host: 'localhost:5173', origin: 'http://localhost:5173' })), true)
  assert.equal(isAllowedRequest(request({ host: '[::1]:5173' })), true)
  assert.equal(isAllowedRequest(request({ host: '127.0.0.1:5173', origin: 'http://127.0.0.1:5174' })), false)
  assert.equal(isAllowedRequest(request({ host: '127.0.0.1:5173', origin: 'null' })), false)
  assert.equal(isAllowedRequest(request({ host: 'example.com' })), false)
  assert.equal(isAllowedRequest(request({ host: 'deck.localhost:7777', origin: 'http://deck.localhost:7777' })), true)
  assert.equal(isAllowedRequest(request({ host: 'deck.localhost:7777', origin: 'http://other.localhost:7777' })), false)
  assert.equal(isAllowedRequest(request({ host: 'localhost.example.com' })), false)
  assert.equal(isAllowedRequest(request({})), false)
})

test('deck-local extensions can be read, written and removed; built-ins are read-only', async () => {
  const read = await api('/extension/layout/comparison')
  assert.equal(read.status, 200)
  const body = await read.json()
  assert.equal(body.source, 'local')
  assert.ok(body.files['extension.toml'].includes('kind = "layout"'))
  assert.ok(body.files['layout.jsx'].includes('MarkdownRegion'))
  assert.equal((await api('/extension/palette/paper')).status, 200)
  assert.equal((await api('/extension/palette/nope')).status, 404)
  assert.equal((await api('/extension/thing/paper')).status, 400)

  const toml = 'schema = 1\nkind = "palette"\nid = "ocean"\ntitle = "Ocean"\ndark = true\n[tokens]\n"--bg" = "#102030"\n"--accent" = "#ffbd69"\n'
  const created = await api('/extension/palette/ocean', { method: 'PUT', body: JSON.stringify({ files: { 'extension.toml': toml } }) })
  const createdText = await created.text()
  assert.equal(created.status, 200, createdText)
  const payload = JSON.parse(createdText)
  assert.ok(payload.registry.palettes.find(p => p.id === 'ocean' && p.source === 'local'))
  assert.equal(readFileSync(resolve(dir, 'extensions/ocean/extension.toml'), 'utf8'), toml)

  const invalid = await api('/extension/palette/ocean', { method: 'PUT', body: JSON.stringify({ files: { 'extension.toml': toml.replace('"--bg"', '"bg"') } }) })
  assert.equal(invalid.status, 500)
  assert.match((await invalid.json()).error, /tokens.bg/)
  assert.equal(readFileSync(resolve(dir, 'extensions/ocean/extension.toml'), 'utf8'), toml, 'invalid manifests are not written')

  const builtin = await api('/extension/palette/paper', { method: 'PUT', body: JSON.stringify({ files: { 'extension.toml': toml.replace('ocean', 'paper') } }) })
  assert.equal(builtin.status, 403)
  const mismatch = await api('/extension/theme/ocean', { method: 'PUT', body: JSON.stringify({ files: { 'extension.toml': toml } }) })
  assert.equal(mismatch.status, 409)
  const escape = await api('/extension/palette/ocean', { method: 'PUT', body: JSON.stringify({ files: { '../evil.toml': 'x', 'extension.toml': toml } }) })
  assert.equal(escape.status, 400)
  assert.equal((await api('/extension/palette/Ocean', { method: 'PUT', body: '{}' })).status, 400)

  const tomlTemplate = 'schema = 1\nkind = "layout"\nid = "box"\ntitle = "Box"\n[regions.body]\n'
  const noLayout = await api('/extension/layout/box', { method: 'PUT', body: JSON.stringify({ files: { 'extension.toml': tomlTemplate } }) })
  assert.equal(noLayout.status, 500)
  assert.match((await noLayout.json()).error, /layout.jsx is missing/)
  const withLayout = await api('/extension/layout/box', { method: 'PUT', body: JSON.stringify({ files: { 'extension.toml': tomlTemplate, 'layout.jsx': 'export default () => null\n', 'starter.md': '# Box\n' } }) })
  assert.equal(withLayout.status, 200)
  const dropStarter = await api('/extension/layout/box', { method: 'PUT', body: JSON.stringify({ files: { 'starter.md': null } }) })
  assert.equal(dropStarter.status, 200)
  assert.deepEqual(Object.keys((await dropStarter.json()).files).sort(), ['extension.toml', 'layout.jsx'])

  assert.equal((await api('/extension/palette/paper', { method: 'DELETE' })).status, 403)
  assert.equal((await api('/extension/palette/ocean', { method: 'DELETE' })).status, 200)
  assert.equal((await api('/extension/layout/box', { method: 'DELETE' })).status, 200)
  assert.equal(existsSync(resolve(dir, 'extensions/ocean')), false)
  assert.ok((await (await api('/deck')).json()).registry.palettes.every(p => p.id !== 'ocean'))
})
