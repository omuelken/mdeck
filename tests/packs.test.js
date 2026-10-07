import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createServer } from 'node:http'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { bundledPacksRoot } from '../src/paths.js'
import { bundledPacks, loadRegistry } from '../src/extensions/discover.js'
import { buildRepository, bundlePack, checkPack, PackError, satisfies, compareVersions } from '../src/extensions/packs.js'

const run = promisify(execFile)
const temp = mkdtempSync(resolve(tmpdir(), 'mdeck-packs-'))
const bundled = bundledPacks({ all: true })

// A repository with three packs: two palettes; a theme copied from neue with
// its own palette; and a theme that takes its palette from the first pack.
const packs = resolve(temp, 'packs')
function writePack(id, version, files, extra = '') {
  const dir = resolve(packs, id)
  mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, 'pack.toml'), `schema = 1\nid = "${id}"\ntitle = "${id} pack"\nversion = "${version}"\nauthor = "Test"\nlicense = "MIT"\nmdeck = ">=2.0.0"\n${extra}`)
  for (const [path, text] of Object.entries(files)) { mkdirSync(resolve(dir, path, '..'), { recursive: true }); writeFileSync(resolve(dir, path), text) }
}
const palette = (id, accent) => `schema = 1\nkind = "palette"\nid = "${id}"\ntitle = "${id}"\n\n[light]\n"--bg" = "#ffffff"\n"--surface" = "#f2f2f2"\n"--ink" = "#111111"\n"--ink-soft" = "#333333"\n"--muted" = "#666666"\n"--rule" = "#dddddd"\n"--accent" = "${accent}"\n"--accent-2" = "#c2410c"\n"--on-accent" = "#ffffff"\n\n[dark]\n"--bg" = "#111111"\n"--surface" = "#1e1e1e"\n"--ink" = "#f2f2f2"\n"--ink-soft" = "#cfcfcf"\n"--muted" = "#8f8f8f"\n"--rule" = "#2e2e2e"\n"--accent" = "#6aaeff"\n"--accent-2" = "#fb923c"\n"--on-accent" = "#111111"\n`
const neue = readFileSync(resolve(bundledPacksRoot, 'neue/neue/extension.toml'), 'utf8')
const theme = (id, paletteId) => neue.replace(/^id = .*$/m, `id = "${id}"`).replace(/^title = .*$/m, `title = "${id}"`).replace(/^palette = .*$/m, `palette = "${paletteId}"`)
writePack('solar', '1.0.0', { 'solar-light/extension.toml': palette('solar-light', '#268bd2'), 'solar-warm/extension.toml': palette('solar-warm', '#cb4b16') })
writePack('plain', '1.0.0', { 'plain/extension.toml': theme('plain', 'plain-ink'), 'plain/styles.css': '.slide { color: var(--ink); }\n', 'plain-ink/extension.toml': palette('plain-ink', '#0b6bcb') })
writePack('sunny', '1.0.0', { 'sunny/extension.toml': theme('sunny', 'solar-warm'), 'sunny/styles.css': '' }, 'requires = ["solar"]\n')

const site = resolve(temp, 'site')
buildRepository(packs, site, { bundled })
const server = createServer((request, response) => {
  const file = resolve(site, '.' + decodeURIComponent(new URL(request.url, 'http://x').pathname))
  if (!file.startsWith(site) || !existsSync(file)) { response.writeHead(404); return response.end() }
  response.writeHead(200, { 'Content-Type': file.endsWith('.json') ? 'application/json' : 'application/octet-stream' })
  response.end(readFileSync(file))
})
await new Promise(done => server.listen(0, '127.0.0.1', done))
after(() => server.close())
const home = resolve(temp, 'home')
const userRoot = resolve(home, 'extensions')
const online = { ...process.env, MDECK_HOME: home, MDECK_THEMES_URL: `http://127.0.0.1:${server.address().port}/index.json`, NO_COLOR: '1' }
const offline = { ...online, MDECK_THEMES_URL: 'http://127.0.0.1:9/index.json' }
const mdeck = (...args) => run(process.execPath, [resolve('bin/mdeck.js'), 'themes', ...args], { env: online }).catch(error => error)
const mdeckOffline = (...args) => run(process.execPath, [resolve('bin/mdeck.js'), 'themes', ...args], { env: offline }).catch(error => error)
// What a deck sees, with this test's home folder.
const registryOf = slides => { const before = process.env.MDECK_HOME; process.env.MDECK_HOME = home; try { return loadRegistry(slides, { userRoot }) } finally { if (before === undefined) delete process.env.MDECK_HOME; else process.env.MDECK_HOME = before } }

const deckDir = resolve(temp, 'talk')
mkdirSync(deckDir)
const deck = resolve(deckDir, 'slides.md')
writeFileSync(deck, '---\ntheme: neue\n---\n\n---\n# Hello\n')

test('versions and ranges compare by number', () => {
  assert.ok(compareVersions('2.10.0', '2.9.1') > 0)
  assert.ok(satisfies('>=2.3.0', '2.3.0') && satisfies(undefined, '0.1.0') && !satisfies('>=2.3.0', '2.2.9'))
})

test('the repository lists its packs and the bundled ones, each with its checksum and requirements', () => {
  const index = JSON.parse(readFileSync(resolve(site, 'index.json'), 'utf8'))
  const ids = index.packs.map(p => p.id)
  for (const id of ['plain', 'solar', 'sunny', ...Object.keys(bundled)]) assert.ok(ids.includes(id), id)
  assert.deepEqual(index.packs.find(p => p.id === 'sunny').requires, ['solar'])
  assert.equal(index.packs.find(p => p.id === 'neue').bundled, true)
  assert.equal(index.packs.find(p => p.id === 'plain').bundled, undefined)
  for (const pack of index.packs.filter(p => !p.bundled)) assert.equal(bundlePack(resolve(packs, pack.id)).sha256, pack.sha256)
})

test('install puts a pack where every deck finds it; remove takes it away', async () => {
  const installed = await mdeck('install', 'plain')
  assert.match(installed.stdout, /Installed plain 1\.0\.0 for every deck/)
  assert.equal(registryOf(deck).themes.plain.source, 'user')
  const marker = JSON.parse(readFileSync(resolve(userRoot, 'plain/.mdeck-pack.json'), 'utf8'))
  assert.deepEqual([marker.pack, marker.version], ['plain', '1.0.0'])
  assert.match((await mdeck('list')).stdout, /plain 1\.0\.0 — plain, plain-ink/)

  // A file changed by hand is not removed without --force.
  writeFileSync(resolve(userRoot, 'plain/styles.css'), '.slide { color: red; }\n')
  const refused = await mdeck('remove', 'plain')
  assert.equal(refused.code, 1)
  assert.match(refused.stderr, /changed since it was installed \(styles\.css\)/)
  assert.match((await mdeck('remove', 'plain', '--force')).stdout, /Removed plain for every deck/)
  assert.ok(!existsSync(resolve(userRoot, 'plain')) && !existsSync(resolve(userRoot, 'plain-ink')))
})

test('with a slides file or --local, a pack goes beside the deck and replaces one for every deck', async () => {
  await mdeck('install', 'solar')
  assert.match((await mdeck('install', 'solar', deck)).stdout, /Installed solar 1\.0\.0 in .*talk\/extensions/)
  const registry = registryOf(deck)
  assert.equal(registry.palettes['solar-light'].source, 'local')
  assert.match(registry.warnings.join('\n'), /palette "solar-light" in this deck's extensions replaces the one installed/)
  assert.match((await mdeck('remove', 'solar', deckDir, '--local')).stdout, /Removed solar in .*talk\/extensions/)
  assert.match((await mdeck('remove', 'solar')).stdout, /Removed solar for every deck/)
  const missing = await mdeck('install', 'solar', resolve(temp, 'nowhere'))
  assert.match(missing.stderr, /does not exist/)
})

test('a pack brings the packs it requires, and a required pack stays while it is needed', async () => {
  const installed = await mdeck('install', 'sunny')
  assert.match(installed.stdout, /Installed solar 1\.0\.0 for every deck/)
  assert.match(installed.stdout, /Installed sunny 1\.0\.0 for every deck/)
  assert.equal(registryOf(deck).themes.sunny.manifest.palette, 'solar-warm')
  const refused = await mdeck('remove', 'solar')
  assert.match(refused.stderr, /sunny requires solar/)
  await mdeck('remove', 'sunny')
  assert.match((await mdeck('remove', 'solar')).stdout, /Removed solar/)
})

test('a pack that comes with mdeck is removed for every deck and comes back without the internet', async () => {
  assert.match((await mdeckOffline('remove', 'aurora')).stdout, /aurora comes with mdeck and is no longer offered/)
  assert.ok(!registryOf(deck).themes.aurora, 'removed')
  assert.match((await mdeckOffline('list')).stdout, /aurora \(removed/)
  const back = await mdeckOffline('install', 'aurora')
  assert.match(back.stdout, /could not be reached/)
  assert.match(back.stdout, /aurora comes with mdeck and is offered again for every deck/)
  assert.equal(registryOf(deck).themes.aurora.source, 'built-in')
  // Beside a deck it is copied, so the slide folder carries it.
  assert.match((await mdeckOffline('install', 'aurora', deck)).stdout, /Installed aurora 1\.0\.0 in .*talk\/extensions: themes aurora; palettes neon/)
  assert.equal(registryOf(deck).themes.aurora.source, 'local')
  await mdeckOffline('remove', 'aurora', deck)
})

test('the last theme cannot be removed', async () => {
  for (const id of ['academic', 'aurora', 'minimal']) assert.match((await mdeckOffline('remove', id)).stdout, /no longer offered/)
  const refused = await mdeckOffline('remove', 'neue', '--force')
  assert.equal(refused.code, 1)
  assert.match(refused.stderr, /neue has the last theme installed for every deck \(neue\); install another theme first/)
  assert.ok(registryOf(deck).themes.neue)
  for (const id of ['academic', 'aurora', 'minimal']) await mdeckOffline('install', id)
})

test('a deck without a theme says so when neue is removed', async () => {
  const plainDeck = resolve(temp, 'plain.md')
  writeFileSync(plainDeck, '# Hello\n')
  await mdeckOffline('remove', 'neue')
  const { validateDeck } = await import('../src/core/validateDeck.js')
  const { parseSlides } = await import('../src/core/parseSlides.js')
  const { manifestsOf } = await import('../src/extensions/discover.js')
  const registry = registryOf(plainDeck)
  const diagnostics = validateDeck(parseSlides('# Hello\n'), { themes: manifestsOf(registry, 'theme'), palettes: manifestsOf(registry, 'palette') })
  assert.match(diagnostics.map(d => d.message).join('\n'), /uses neue, which is not installed: run mdeck themes install neue/)
  await mdeckOffline('install', 'neue')
  assert.ok(registryOf(plainDeck).themes.neue)
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
  writePack('solar', '1.1.0', { 'solar-light/extension.toml': palette('solar-light', '#2aa198'), 'solar-warm/extension.toml': palette('solar-warm', '#cb4b16') })
  buildRepository(packs, site, { bundled })
  assert.match((await mdeck('update', deck)).stdout, /Updated solar 1\.0\.0 → 1\.1\.0/)
  assert.match(readFileSync(resolve(deckDir, 'extensions/solar-light/extension.toml'), 'utf8'), /#2aa198/)
})

test('a pack that does not match its checksum is not installed', async () => {
  const index = JSON.parse(readFileSync(resolve(site, 'index.json'), 'utf8'))
  const file = resolve(site, index.packs.find(p => p.id === 'plain').url)
  writeFileSync(file, readFileSync(file, 'utf8').replace('"plain"', '"plain" '))
  const refused = await mdeck('install', 'plain')
  assert.equal(refused.code, 1)
  assert.match(refused.stderr, /does not match its checksum/)
})

test('packs hold only theme and palette text, fonts from font hosts, and palettes they have or require', () => {
  const base = bundlePack(resolve(packs, 'plain')).bundle
  const variant = files => ({ ...base, files: { ...base.files, ...files } })
  const reject = (bundle, pattern, options) => assert.throws(() => checkPack(bundle, options), error => error instanceof PackError && pattern.test(error.message))
  assert.deepEqual([checkPack(base).themes, checkPack(base).palettes], [['plain'], ['plain-ink']])
  reject(variant({ 'plain/layout.jsx': 'export default () => null' }), /is not allowed/)
  reject(variant({ '../evil/extension.toml': 'x' }), /is not allowed/)
  reject(variant({ 'plain/styles.css': '@import "https://example.org/x.css";' }), /@import is not allowed/)
  reject(variant({ 'plain/styles.css': '.slide { background: url(https://example.org/track.png) }' }), /only data: URLs/)
  reject(variant({ 'plain/extension.toml': theme('plain', 'plain-ink').replace(/^fonts = \[[\s\S]*?\]$/m, 'fonts = ["https://example.org/font.css"]') }), /loads fonts from https:\/\/example\.org/)
  reject({ ...base, files: { 'swiss/extension.toml': palette('swiss', '#000000') } }, /already the id of a theme or palette in the pack neue/, { owners: { swiss: 'neue' } })
  const sunny = bundlePack(resolve(packs, 'sunny')).bundle
  reject(sunny, /names the palette "solar-warm", which is not in the pack or in solar/)
  assert.deepEqual(checkPack(sunny, { provided: { themes: {}, palettes: { 'solar-warm': {} } } }).themes, ['sunny'])
})
