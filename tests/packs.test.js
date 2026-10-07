import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createServer } from 'node:http'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { builtinExtensionsRoot } from '../src/paths.js'
import { discoverExtensions, loadRegistry } from '../src/extensions/discover.js'
import { checkDeck } from '../src/build/check.js'
import { buildRepository, bundlePack, checkPack, PackError, satisfies, compareVersions } from '../src/extensions/packs.js'

const run = promisify(execFile)
const temp = mkdtempSync(resolve(tmpdir(), 'mdeck-packs-'))
const builtIn = discoverExtensions([{ dir: builtinExtensionsRoot, source: 'built-in' }])
const known = { themes: builtIn.themes, palettes: builtIn.palettes }

// A repository with two packs: two palettes, and a theme copied from neue
// with its own palette.
const packs = resolve(temp, 'packs')
function writePack(id, version, files) {
  const dir = resolve(packs, id)
  mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, 'pack.toml'), `schema = 1\nid = "${id}"\ntitle = "${id} pack"\nversion = "${version}"\nauthor = "Test"\nlicense = "MIT"\nmdeck = ">=2.0.0"\n`)
  for (const [path, text] of Object.entries(files)) { mkdirSync(resolve(dir, path, '..'), { recursive: true }); writeFileSync(resolve(dir, path), text) }
}
const palette = (id, accent) => `schema = 1\nkind = "palette"\nid = "${id}"\ntitle = "${id}"\n\n[light]\n"--bg" = "#ffffff"\n"--surface" = "#f2f2f2"\n"--ink" = "#111111"\n"--ink-soft" = "#333333"\n"--muted" = "#666666"\n"--rule" = "#dddddd"\n"--accent" = "${accent}"\n"--accent-2" = "#c2410c"\n"--on-accent" = "#ffffff"\n\n[dark]\n"--bg" = "#111111"\n"--surface" = "#1e1e1e"\n"--ink" = "#f2f2f2"\n"--ink-soft" = "#cfcfcf"\n"--muted" = "#8f8f8f"\n"--rule" = "#2e2e2e"\n"--accent" = "#6aaeff"\n"--accent-2" = "#fb923c"\n"--on-accent" = "#111111"\n`
const neue = readFileSync(resolve(builtinExtensionsRoot, 'themes/neue/extension.toml'), 'utf8')
const themeToml = neue.replace(/^id = .*$/m, 'id = "plain"').replace(/^title = .*$/m, 'title = "Plain"').replace(/^palette = .*$/m, 'palette = "plain-ink"')
writePack('solar', '1.0.0', { 'solar-light/extension.toml': palette('solar-light', '#268bd2'), 'solar-warm/extension.toml': palette('solar-warm', '#cb4b16') })
writePack('plain', '1.0.0', { 'plain/extension.toml': themeToml, 'plain/styles.css': '.slide { color: var(--ink); }\n', 'plain-ink/extension.toml': palette('plain-ink', '#0b6bcb') })

const site = resolve(temp, 'site')
buildRepository(packs, site, { known })
const server = createServer((request, response) => {
  const file = resolve(site, '.' + decodeURIComponent(new URL(request.url, 'http://x').pathname))
  if (!file.startsWith(site) || !existsSync(file)) { response.writeHead(404); return response.end() }
  response.writeHead(200, { 'Content-Type': file.endsWith('.json') ? 'application/json' : 'application/octet-stream' })
  response.end(readFileSync(file))
})
await new Promise(done => server.listen(0, '127.0.0.1', done))
after(() => server.close())
const home = resolve(temp, 'home')
const env = { ...process.env, MDECK_HOME: home, MDECK_THEMES_URL: `http://127.0.0.1:${server.address().port}/index.json`, NO_COLOR: '1' }
const mdeck = (...args) => run(process.execPath, [resolve('bin/mdeck.js'), 'themes', ...args], { env }).catch(error => error)

const deckDir = resolve(temp, 'talk')
mkdirSync(deckDir)
const deck = resolve(deckDir, 'slides.md')
writeFileSync(deck, '---\ntheme: neue\n---\n\n---\n# Hello\n')

test('versions and ranges compare by number', () => {
  assert.ok(compareVersions('2.10.0', '2.9.1') > 0)
  assert.ok(satisfies('>=2.3.0', '2.3.0') && satisfies(undefined, '0.1.0') && !satisfies('>=2.3.0', '2.2.9'))
})

test('the repository index lists each pack with its checksum', () => {
  const index = JSON.parse(readFileSync(resolve(site, 'index.json'), 'utf8'))
  assert.deepEqual(index.packs.map(p => [p.id, p.themes, p.palettes]), [['plain', ['plain'], ['plain-ink']], ['solar', [], ['solar-light', 'solar-warm']]])
  for (const pack of index.packs) assert.equal(bundlePack(resolve(packs, pack.id)).sha256, pack.sha256)
})

test('install puts a pack beside the deck, where the deck finds it; remove takes it away', async () => {
  const installed = await mdeck('install', 'plain', deck)
  assert.match(installed.stdout, /Installed plain/)
  const registry = loadRegistry(deck, { userRoot: resolve(home, 'extensions') })
  assert.equal(registry.themes.plain.source, 'local')
  assert.equal(registry.palettes['plain-ink'].source, 'local')
  const marker = JSON.parse(readFileSync(resolve(deckDir, 'extensions/plain/.mdeck-pack.json'), 'utf8'))
  assert.equal(marker.pack, 'plain')
  assert.equal(marker.version, '1.0.0')
  assert.match((await mdeck('list', deck)).stdout, /plain 1\.0\.0 — plain, plain-ink/)
  assert.match((await mdeck('search', 'solar')).stdout, /solar 1\.0\.0/)

  // A file changed by hand is not removed without --force.
  writeFileSync(resolve(deckDir, 'extensions/plain/styles.css'), '.slide { color: red; }\n')
  const refused = await mdeck('remove', 'plain', deck)
  assert.equal(refused.code, 1)
  assert.match(refused.stderr, /changed since it was installed \(styles\.css\)/)
  assert.ok(existsSync(resolve(deckDir, 'extensions/plain')))
  assert.match((await mdeck('remove', 'plain', deck, '--force')).stdout, /Removed plain/)
  assert.ok(!existsSync(resolve(deckDir, 'extensions/plain')) && !existsSync(resolve(deckDir, 'extensions/plain-ink')))
})

test('--global installs for every deck; a deck copy replaces it with a warning', async () => {
  assert.match((await mdeck('install', 'solar', '--global')).stdout, /Installed solar for every deck/)
  const userRoot = resolve(home, 'extensions')
  assert.equal(loadRegistry(deck, { userRoot }).palettes['solar-light'].source, 'user')
  const usesIt = resolve(temp, 'uses-solar.md')
  writeFileSync(usesIt, '---\ntheme: neue\npalette: solar-light\n---\n\n---\n# Hello\n')
  const { diagnostics } = checkDeck(usesIt, loadRegistry(usesIt, { userRoot }))
  assert.ok(diagnostics.some(d => d.code === 'user-extension' && /installed only on this computer/.test(d.message)))
  cpSync(resolve(userRoot, 'solar-light'), resolve(deckDir, 'extensions/solar-light'), { recursive: true })
  const registry = loadRegistry(deck, { userRoot })
  assert.equal(registry.palettes['solar-light'].source, 'local')
  assert.match(registry.warnings.join('\n'), /palette "solar-light" in this deck's extensions replaces the one installed/)
  assert.match((await mdeck('remove', 'solar', '--global')).stdout, /Removed solar/)
})

test('a folder that is not from the pack is never overwritten', async () => {
  const other = resolve(temp, 'other')
  mkdirSync(resolve(other, 'extensions/solar-warm'), { recursive: true })
  writeFileSync(resolve(other, 'extensions/solar-warm/extension.toml'), palette('solar-warm', '#000000'))
  const refused = await mdeck('install', 'solar', other)
  assert.equal(refused.code, 1)
  assert.match(refused.stderr, /already exists and is not from the pack solar/)
  assert.match(readFileSync(resolve(other, 'extensions/solar-warm/extension.toml'), 'utf8'), /#000000/)
})

test('update installs a newer version in place', async () => {
  await mdeck('install', 'solar', deck)
  rmSync(resolve(packs, 'solar'), { recursive: true })
  writePack('solar', '1.1.0', { 'solar-light/extension.toml': palette('solar-light', '#2aa198') })
  buildRepository(packs, site, { known })
  assert.match((await mdeck('update', deck)).stdout, /Updated solar 1\.0\.0 → 1\.1\.0/)
  assert.match(readFileSync(resolve(deckDir, 'extensions/solar-light/extension.toml'), 'utf8'), /#2aa198/)
  assert.ok(!existsSync(resolve(deckDir, 'extensions/solar-warm')), 'a palette the new version dropped is removed')
})

test('a pack that does not match its checksum is not installed', async () => {
  const index = JSON.parse(readFileSync(resolve(site, 'index.json'), 'utf8'))
  const file = resolve(site, index.packs.find(p => p.id === 'plain').url)
  writeFileSync(file, readFileSync(file, 'utf8').replace('"plain"', '"plain" '))
  const refused = await mdeck('install', 'plain', resolve(temp, 'talk2'))
  assert.equal(refused.code, 1)
  assert.match(refused.stderr, /does not match its checksum/)
})

test('packs hold only theme and palette text, with fonts from font hosts', () => {
  const base = bundlePack(resolve(packs, 'plain')).bundle
  const variant = files => ({ ...base, files: { ...base.files, ...files } })
  const reject = (bundle, pattern) => assert.throws(() => checkPack(bundle, { known }), error => error instanceof PackError && pattern.test(error.message))
  assert.deepEqual(checkPack(base, { known }), { themes: ['plain'], palettes: ['plain-ink'] })
  reject(variant({ 'plain/layout.jsx': 'export default () => null' }), /is not allowed/)
  reject(variant({ '../evil/extension.toml': 'x' }), /is not allowed/)
  reject(variant({ 'plain/styles.css': '@import "https://example.org/x.css";' }), /@import is not allowed/)
  reject(variant({ 'plain/styles.css': '.slide { background: url(https://example.org/track.png) }' }), /only data: URLs/)
  reject(variant({ 'plain/extension.toml': themeToml.replace(/^fonts = \[[\s\S]*?\]$/m, 'fonts = ["https://example.org/font.css"]') }), /loads fonts from https:\/\/example\.org/)
  reject(variant({ 'plain/extension.toml': themeToml.replace('id = "plain"', 'id = "neue"') }), /extension\.toml/)
  reject({ ...base, files: { 'swiss/extension.toml': palette('swiss', '#000000') } }, /id of a built-in palette/)
})
