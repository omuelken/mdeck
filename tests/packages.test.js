import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createServer } from 'node:http'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { builtinExtensionsRoot } from '../src/paths.js'
import { loadRegistry, manifestsOf } from '../src/extensions/discover.js'
import { buildRepository, checkPackage, compareVersions, PackageError, satisfies } from '../src/extensions/packages.js'
import { validateDeck } from '../src/core/validateDeck.js'
import { parseSlides } from '../src/core/parseSlides.js'

const run = promisify(execFile)
const temp = mkdtempSync(resolve(tmpdir(), 'mdeck-packages-'))

// A repository: two palettes; a theme with its own palette; a theme whose
// default palette is in the repository; a theme and a palette that belong to
// each other; and a theme that uses a built-in palette.
const repo = resolve(temp, 'repo')
const META = 'version = "VERSION"\nauthor = "Test"\nlicense = "MIT"\nmdeck = ">=3.1.0"\n'
function write(kind, id, files, version = '1.0.0') {
  const dir = resolve(repo, `${kind}s`, id)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  for (const [name, text] of Object.entries(files)) writeFileSync(resolve(dir, name), text.replace('VERSION', version))
}
const palette = (id, accent, extra = '') => `schema = 1\nkind = "palette"\nid = "${id}"\ntitle = "${id}"\n${META}${extra}\n[light]\n"--bg" = "#ffffff"\n"--surface" = "#f2f2f2"\n"--ink" = "#111111"\n"--ink-soft" = "#333333"\n"--muted" = "#666666"\n"--rule" = "#dddddd"\n"--accent" = "${accent}"\n"--accent-2" = "#c2410c"\n"--on-accent" = "#ffffff"\n\n[dark]\n"--bg" = "#111111"\n"--surface" = "#1e1e1e"\n"--ink" = "#f2f2f2"\n"--ink-soft" = "#cfcfcf"\n"--muted" = "#8f8f8f"\n"--rule" = "#2e2e2e"\n"--accent" = "#6aaeff"\n"--accent-2" = "#fb923c"\n"--on-accent" = "#111111"\n`
const neue = readFileSync(resolve(builtinExtensionsRoot, 'themes/neue/extension.toml'), 'utf8').replace(/^version = .*\n/m, '').replace(/^author = .*\n/m, '').replace(/^license = .*\n/m, '')
const theme = (id, paletteId, extra = '') => neue.replace(/^id = .*$/m, `id = "${id}"\n${META}${extra}`).replace(/^title = .*$/m, `title = "${id}"`).replace(/^palette = .*$/m, `palette = "${paletteId}"`)
write('palette', 'solar-light', { 'extension.toml': palette('solar-light', '#268bd2') })
write('palette', 'solar-warm', { 'extension.toml': palette('solar-warm', '#cb4b16') })
write('theme', 'bare', { 'extension.toml': theme('bare', 'bare-ink'), 'styles.css': '.slide { color: var(--ink); }\n' })
write('palette', 'bare-ink', { 'extension.toml': palette('bare-ink', '#0b6bcb') })
write('theme', 'sunny', { 'extension.toml': theme('sunny', 'solar-warm'), 'styles.css': '' })
write('theme', 'house', { 'extension.toml': theme('house', 'house-colours', 'palettes = ["house-colours"]\n'), 'styles.css': '' })
write('palette', 'house-colours', { 'extension.toml': palette('house-colours', '#0b6bcb', 'theme = "house"\n') })
write('theme', 'calm', { 'extension.toml': theme('calm', 'lagoon'), 'styles.css': '' })

const site = resolve(temp, 'site')
buildRepository(repo, site)
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
const online = { ...process.env, MDECK_HOME: home, MDECK_THEMES_URL: `http://127.0.0.1:${server.address().port}/catalogue.json`, NO_COLOR: '1', FORCE_COLOR: '0' }
const offline = { ...online, MDECK_THEMES_URL: 'http://127.0.0.1:9/catalogue.json' }
const cli = env => (kind, ...args) => run(process.execPath, [resolve('bin/mdeck.js'), kind, ...args], { env }).catch(error => error)
const mdeck = cli(online), mdeckOffline = cli(offline)
// What a deck sees, with this test's home folder.
const registryOf = slides => { const before = process.env.MDECK_HOME; process.env.MDECK_HOME = home; try { return loadRegistry(slides, { userRoot }) } finally { process.env.MDECK_HOME = before } }

const deckDir = resolve(temp, 'talk')
mkdirSync(deckDir)
const deck = resolve(deckDir, 'slides.md')
writeFileSync(deck, '---\ntheme: neue\n---\n\n---\n# Hello\n')

test('versions and ranges compare by number', () => {
  assert.ok(compareVersions('2.10.0', '2.9.1') > 0)
  assert.ok(satisfies('>=2.3.0', '2.3.0') && satisfies(undefined, '0.1.0') && !satisfies('>=2.3.0', '2.2.9'))
})

test('the catalogue lists every theme and palette, the built-in ones marked, each with its checksum', () => {
  const catalogue = JSON.parse(readFileSync(resolve(site, 'catalogue.json'), 'utf8'))
  assert.equal(catalogue.schema, 2)
  const bare = catalogue.themes.find(t => t.id === 'bare')
  assert.equal(bare.palette, 'bare-ink')
  assert.equal(bare.url, 'themes/bare-1.0.0.json')
  assert.match(bare.sha256, /^[0-9a-f]{64}$/)
  assert.equal(catalogue.palettes.find(p => p.id === 'house-colours').theme, 'house')
  assert.ok(catalogue.themes.find(t => t.id === 'neue').builtIn)
  assert.ok(catalogue.palettes.find(p => p.id === 'lagoon').builtIn)
})

test('installing a theme brings its default palette; both land where every deck finds them', async () => {
  const installed = await mdeck('themes', 'install', 'bare')
  assert.match(installed.stdout, /Installed the palette bare-ink 1\.0\.0 for every deck[\s\S]*Installed the theme bare 1\.0\.0 for every deck/)
  assert.ok(existsSync(resolve(userRoot, 'themes/bare/.mdeck-package.json')))
  assert.ok(existsSync(resolve(userRoot, 'palettes/bare-ink/extension.toml')))
  const registry = registryOf(deck)
  assert.equal(registry.themes.bare.source, 'user')
  assert.equal(registry.palettes['bare-ink'].source, 'user')
  // A built-in default palette is not copied.
  assert.match((await mdeck('themes', 'install', 'calm')).stdout, /Installed the theme calm/)
  assert.ok(!existsSync(resolve(userRoot, 'palettes/lagoon')))
})

test('a palette in use as a default stays; removing its theme lets it go', async () => {
  const refused = await mdeck('palettes', 'remove', 'bare-ink')
  assert.equal(refused.code, 1)
  assert.match(refused.stderr, /bare uses the palette bare-ink by default; remove that theme first/)
  assert.match((await mdeck('themes', 'remove', 'bare')).stdout, /Removed the theme bare for every deck/)
  assert.match((await mdeck('palettes', 'remove', 'bare-ink')).stdout, /Removed the palette bare-ink for every deck/)
})

test('a theme and the palette made for it come and go together', async () => {
  const installed = await mdeck('palettes', 'install', 'house-colours')
  assert.match(installed.stdout, /Installed the theme house[\s\S]*Installed the palette house-colours/)
  assert.ok(registryOf(deck).palettes['house-colours'])
  const removed = await mdeck('themes', 'remove', 'house')
  assert.match(removed.stdout, /Removed the theme house[\s\S]*Removed the palette house-colours/)
  assert.ok(!existsSync(resolve(userRoot, 'palettes/house-colours')))
})

test('beside a deck, a theme comes with its palette even if every deck has that one', async () => {
  await mdeck('palettes', 'install', 'solar-warm')
  const installed = await mdeck('themes', 'install', 'sunny', deck)
  assert.match(installed.stdout, /Installed the palette solar-warm 1\.0\.0 in .*talk\/extensions[\s\S]*Installed the theme sunny/)
  assert.ok(existsSync(resolve(deckDir, 'extensions/palettes/solar-warm/extension.toml')))
  assert.equal(registryOf(deck).themes.sunny.source, 'local')
  assert.match((await mdeck('themes', 'remove', 'sunny', deck)).stdout, /Removed the theme sunny in/)
  await mdeck('palettes', 'remove', 'solar-warm', deck)
  await mdeck('palettes', 'remove', 'solar-warm')
})

test('a built-in theme is removed for every deck and comes back without the internet', async () => {
  assert.match((await mdeckOffline('themes', 'remove', 'glass')).stdout, /comes with mdeck and is no longer offered/)
  assert.ok(!registryOf(deck).themes.glass)
  assert.match((await mdeckOffline('themes', 'list')).stdout, /glass \(removed; mdeck themes install glass brings it back\)/)
  assert.match((await mdeckOffline('themes', 'install', 'glass')).stdout, /comes with mdeck and is offered again/)
  assert.ok(registryOf(deck).themes.glass)
})

test('the last theme cannot be removed, and a deck without a theme says so when neue is gone', async () => {
  for (const id of ['academic', 'glass', 'minimal', 'plain', 'work', 'calm']) await mdeckOffline('themes', 'remove', id)
  const refused = await mdeckOffline('themes', 'remove', 'neue', '--force')
  assert.equal(refused.code, 1)
  assert.match(refused.stderr, /neue is the last theme for every deck; install another theme first/)
  await mdeckOffline('themes', 'install', 'academic')
  await mdeckOffline('themes', 'remove', 'neue')
  const registry = registryOf(resolve(temp, 'plain.md'))
  const diagnostics = validateDeck(parseSlides('# Hello\n'), { themes: manifestsOf(registry, 'theme'), palettes: manifestsOf(registry, 'palette') })
  assert.match(diagnostics.map(d => d.message).join('\n'), /uses neue, which is not installed: run mdeck themes install neue/)
  for (const id of ['neue', 'glass', 'minimal', 'plain', 'work']) await mdeckOffline('themes', 'install', id)
})

test('a folder of the deck\'s own is never overwritten', async () => {
  const other = resolve(temp, 'other')
  mkdirSync(resolve(other, 'extensions/palettes/solar-light'), { recursive: true })
  writeFileSync(resolve(other, 'extensions/palettes/solar-light/extension.toml'), palette('solar-light', '#000000').replace('VERSION', '1.0.0'))
  const refused = await mdeck('palettes', 'install', 'solar-light', other)
  assert.equal(refused.code, 1)
  assert.match(refused.stderr, /already exists and was not installed by mdeck/)
  assert.match(readFileSync(resolve(other, 'extensions/palettes/solar-light/extension.toml'), 'utf8'), /#000000/)
})

test('update installs a newer version in place, and keeps files changed by hand unless forced', async () => {
  await mdeck('palettes', 'install', 'solar-light')
  write('palette', 'solar-light', { 'extension.toml': palette('solar-light', '#2aa198') }, '1.1.0')
  buildRepository(repo, site)
  const file = resolve(userRoot, 'palettes/solar-light/extension.toml')
  writeFileSync(file, readFileSync(file, 'utf8') + '\n')
  const refused = await mdeck('palettes', 'update')
  assert.equal(refused.code, 1)
  assert.match(refused.stderr, /was changed since it was installed \(extension\.toml\)/)
  assert.match((await mdeck('palettes', 'update', '--force')).stdout, /Updated the palette solar-light 1\.0\.0 → 1\.1\.0/)
  assert.match(readFileSync(file, 'utf8'), /#2aa198/)
})

test('a package that does not match its checksum is not installed', async () => {
  const catalogue = JSON.parse(readFileSync(resolve(site, 'catalogue.json'), 'utf8'))
  const file = resolve(site, catalogue.palettes.find(p => p.id === 'solar-warm').url)
  writeFileSync(file, readFileSync(file, 'utf8').replace('"solar-warm"', '"solar-warm" '))
  mkdirSync(resolve(temp, 'talk2'))
  const refused = await mdeck('palettes', 'install', 'solar-warm', resolve(temp, 'talk2'))
  assert.equal(refused.code, 1)
  assert.match(refused.stderr, /does not match its checksum/)
})

test('packages hold only theme and palette text, with fonts from font hosts', () => {
  const files = { 'extension.toml': theme('bare', 'bare-ink').replace('VERSION', '1.0.0'), 'styles.css': '.slide {}' }
  const reject = (kind, id, changes, pattern) => assert.throws(() => checkPackage({ kind, id, files: { ...files, ...changes } }), error => error instanceof PackageError && pattern.test(error.message))
  assert.equal(checkPackage({ kind: 'theme', id: 'bare', files }).id, 'bare')
  reject('theme', 'bare', { 'layout.jsx': 'export default () => null' }, /"layout\.jsx" is not allowed/)
  reject('theme', 'bare', { 'styles.css': '@import "https://example.org/x.css";' }, /@import is not allowed/)
  reject('theme', 'bare', { 'styles.css': '.slide { background: url(https://example.org/track.png) }' }, /only data: URLs/)
  reject('theme', 'bare', { 'extension.toml': files['extension.toml'].replace(/^fonts = \[[\s\S]*?\]$/m, 'fonts = ["https://example.org/font.css"]') }, /loads fonts from https:\/\/example\.org/)
  reject('palette', 'bare', {}, /says kind = "theme", but it is in the palettes|"styles\.css" is not allowed/)
  assert.throws(() => checkPackage({ kind: 'theme', id: 'bare', files: { ...files, 'extension.toml': files['extension.toml'].replace(/^author = .*\n/m, '') } }, { published: true }), /author is required/)
})

test('the repository refuses a theme whose palette is nowhere, and two of one id', () => {
  write('theme', 'lost', { 'extension.toml': theme('lost', 'nowhere'), 'styles.css': '' })
  assert.throws(() => buildRepository(repo, resolve(temp, 'site2')), /The theme lost needs the palette "nowhere"/)
  rmSync(resolve(repo, 'themes/lost'), { recursive: true })
  write('palette', 'lagoon', { 'extension.toml': palette('lagoon', '#000000') })
  assert.throws(() => buildRepository(repo, resolve(temp, 'site2')), /two palettes "lagoon"; one comes with mdeck/)
  rmSync(resolve(repo, 'palettes/lagoon'), { recursive: true })
})
