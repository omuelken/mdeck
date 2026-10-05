import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, unlinkSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createRelayAccess } from '../src/build/relayAccess.js'

test('relay access follows the entry graph and assets, protects symlinks and rejects public shadows', async t => {
  const dir = mkdtempSync(resolve(tmpdir(), 'mdeck-relay-policy-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const runtime = resolve(dir, 'runtime'), deckDir = resolve(dir, 'deck'), base = '/t/test-tunnel-0123456789/'
  mkdirSync(runtime); mkdirSync(deckDir)
  writeFileSync(resolve(runtime, 'main.jsx'), 'export {}')
  writeFileSync(resolve(runtime, 'index.html'), '<html></html>')
  const source = '# Talk\n\n![Photo](./photo.svg)\n'
  const slides = resolve(deckDir, 'slides.md')
  writeFileSync(slides, source)
  writeFileSync(resolve(deckDir, 'real.svg'), '<svg/>')
  symlinkSync('real.svg', resolve(deckDir, 'photo.svg'))
  writeFileSync(resolve(deckDir, 'private.svg'), 'PRIVATE')
  writeFileSync(resolve(deckDir, 'private.js'), 'PRIVATE')
  const child = { id: '\0virtual:slides', url: '/@id/virtual:slides', file: null, importedModules: new Set() }
  const entry = { id: resolve(runtime, 'main.jsx'), file: resolve(runtime, 'main.jsx'), url: '/main.jsx', importedModules: new Set([child]) }
  const unrelated = { id: resolve(deckDir, 'private.js'), file: resolve(deckDir, 'private.js'), url: `/@fs${deckDir}/private.js`, importedModules: new Set() }
  const graph = { getModuleById: id => id === entry.id ? entry : unrelated, getModuleByUrl: async () => null }
  const allow = createRelayAccess({ config: { base, root: runtime }, environments: { client: { moduleGraph: graph } } }, slides)
  assert.equal(await allow(base + 'main.jsx', 'GET'), true)
  assert.equal(await allow(base + '@id/__x00__virtual:slides', 'GET'), true)
  assert.equal(await allow(base + 'photo.svg', 'GET'), true)
  for (const path of ['private.svg', 'private.js?raw', '@id/__x00__private', `@fs${deckDir}/private.js`, 'main.jsx?raw']) assert.equal(await allow(base + path, 'GET'), false, path)
  unlinkSync(resolve(deckDir, 'photo.svg')); symlinkSync('private.svg', resolve(deckDir, 'photo.svg'))
  assert.equal(await allow(base + 'photo.svg', 'GET'), false, 'changing a symlink does not expose another file')
  writeFileSync(resolve(deckDir, 'main.jsx'), 'PRIVATE_SHADOW')
  writeFileSync(resolve(deckDir, 'index.html'), 'PRIVATE_SHADOW')
  assert.equal(await allow(base + 'main.jsx', 'GET'), false)
  assert.equal(await allow(base + 'index.html', 'GET'), false)
  assert.equal(await allow(base, 'GET'), true)
})
