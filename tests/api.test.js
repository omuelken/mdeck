import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { parseArgs, parseSlideNumbers } from '../src/cli/args.js'
import { slideLabels } from '../src/build/renderCheck.js'
import { migrateDeck } from '../src/cli/migrate.js'
import { parseSlides } from '../src/core/parseSlides.js'
import { readerLink, validatePageUrl } from '../src/core/urls.js'
import { drawingsDiagnostic } from '../src/build/drawings.js'
import { serializeRegistry, loadRegistry } from '../src/extensions/discover.js'

const fixture = t => {
  const dir = mkdtempSync(resolve(tmpdir(), 'mdeck-api-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}

test('command options are strict, with aliases and explicit values', () => {
  for (const args of [['--output'], ['--output', '--reader'], ['--ouput', 'file.html'], ['a.md', 'b.md'], ['--notes'], ['--output='], ['--port', '1234']]) assert.throws(() => parseArgs('build', args))
  assert.deepEqual(parseArgs('build', ['a.md', '-o', 'file.html', '--reader', '--notes']).options, { '--output': 'file.html', '--reader': true, '--notes': true })
  assert.equal(parseArgs('run', ['--server', 'a.md']).options['--server'], null)
  assert.equal(parseArgs('run', ['--server=https://example.org', 'a.md']).options['--server'], 'https://example.org')
  for (const args of [['--server', 'ftp://example.org'], ['--port', '0'], ['--port=NaN'], ['--server', 'https://example.org/path']]) assert.throws(() => parseArgs('run', args))
  assert.deepEqual(parseArgs('skill', ['--project', '--install', 'codex', 'claude']).options['--install'], ['codex', 'claude'])
})

test('snapshot takes slide numbers, single, listed or as a range', () => {
  assert.deepEqual(parseSlideNumbers('3'), [3])
  assert.deepEqual(parseSlideNumbers('5, 2-4,3'), [5, 2, 3, 4])
  assert.deepEqual(parseSlideNumbers(''), [])
  for (const text of ['0', '4-2', '2x', '-3']) assert.throws(() => parseSlideNumbers(text))
  assert.throws(() => parseArgs('snapshot', ['--dark', '--light']))
  assert.deepEqual(parseArgs('check', ['a.md', '--render']).options, { '--render': true })
})

test('render problems name the slide, its heading and the line it starts at', () => {
  const labels = slideLabels('---\ntitle: T\n---\n\n# First *one*\n\n---\n\n\n## Second\n\ntext\n\n---\n\nNo heading here\n')
  assert.deepEqual(labels.map(({ number, line, heading }) => [number, line, heading]), [[1, 5, 'First one'], [2, 10, 'Second'], [3, 16, null]])
})

test('invalid arguments leave existing build output untouched', t => {
  const dir = fixture(t), cli = resolve('bin/mdeck.js')
  mkdirSync(resolve(dir, 'dist'))
  writeFileSync(resolve(dir, 'slides.md'), '# Slides\n')
  const sentinel = resolve(dir, 'dist/important.txt')
  writeFileSync(sentinel, 'keep me')
  for (const args of [['--output'], ['--unknown'], ['--output', '--single-file'], ['extra.md', 'surplus.md']]) {
    const result = spawnSync(process.execPath, [cli, 'build', ...args], { cwd: dir, encoding: 'utf8' })
    assert.equal(result.status, 1, result.stderr)
    assert.equal(readFileSync(sentinel, 'utf8'), 'keep me')
    assert.equal(existsSync(resolve(dir, 'dist/index.html')), false)
  }
})

test('old drawings stop run and every export, unless explicitly excluded', t => {
  const dir = fixture(t), cli = resolve('bin/mdeck.js'), deck = resolve(dir, 'slides.md')
  writeFileSync(deck, '# Slides\n'); writeFileSync(resolve(dir, 'slides.ink.json'), '{}')
  assert.equal(drawingsDiagnostic(deck).code, 'renamed-file')
  for (const command of ['run', 'build', 'send', 'pdf']) {
    const result = spawnSync(process.execPath, [cli, command, deck], { cwd: dir, encoding: 'utf8' })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /mdeck migrate/)
    assert.equal(existsSync(resolve(dir, 'dist')), false)
  }
})

test('old server environment variables fail before startup', () => {
  const result = spawnSync(process.execPath, [resolve('bin/mdeck.js'), 'server'], { env: { ...process.env, MDECK_LIVE_KEY: 'old-key' }, encoding: 'utf8' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /MDECK_LIVE_KEY is now MDECK_SERVER_KEY/)
  assert.equal(result.stderr.includes('old-key'), false)
})

test('reader links keep the view and slide and omit credentials', () => {
  const link = new URL(readerLink('https://example.org/talk.html?theme=neue&view=presenter&serverkey=secret&pair=offer&session=id', 'my slide'))
  assert.equal(link.searchParams.get('view'), 'reader')
  assert.equal(link.hash, '#my%20slide')
  assert.equal(link.searchParams.get('theme'), 'neue')
  for (const name of ['v', 'serverkey', 'pair', 'session']) assert.equal(link.searchParams.has(name), false)
})

test('legacy URLs get an explicit correction without leaking keys', () => {
  const problem = validatePageUrl(new URL('https://example.org/?v=s&design=neue&livekey=secret#two'))
  assert.match(problem.message, /v → view/)
  assert.equal(problem.corrected, 'https://example.org/?view=reader&theme=neue#two')
  assert.equal(JSON.stringify(problem).includes('secret'), false)
  assert.equal(new URL(validatePageUrl(new URL('https://example.org/?view=share')).corrected).searchParams.get('view'), 'reader')
  assert.match(validatePageUrl(new URL('https://example.org/?view=typo')).message, /Unknown view/)
  assert.equal(validatePageUrl(new URL('https://example.org/?view=presenter')), null)
})

test('migration dry run is read-only; apply preserves unrelated bytes and is idempotent', t => {
  const dir = fixture(t), deck = resolve(dir, 'slides.md'), ext = resolve(dir, 'extensions/custom')
  mkdirSync(ext, { recursive: true })
  const source = '---\r\n# keep this\r\ndesign: neue\r\ninstitution: none\r\nlive:\r\n  server: https://example.org\r\n  code: "123456"\r\nmeta: # untouched\r\n  title: "My talk"\r\n---\r\n\r\n# Body\r\n\r\n:::notes\r\nPrivate words\r\n:::\r\n'
  writeFileSync(deck, source)
  const toml = '# leave me\r\nschema = 1\r\nkind = "template" # old name\r\nid = "custom"\r\ntitle = "Custom"\r\n[regions.body]\r\n'
  writeFileSync(resolve(ext, 'extension.toml'), toml)
  const jsx = '// 🐈 mdeck/template-api\r\nimport { Standard } from "mdeck/template-api";\r\nconst text = "mdeck/template-api";\r\nexport default () => <Standard/>;\r\n'
  writeFileSync(resolve(ext, 'layout.jsx'), jsx)
  writeFileSync(resolve(dir, 'slides.ink.json'), '{"version":1}')
  assert.equal(migrateDeck(deck, { dryRun: true }).length, 4)
  assert.equal(readFileSync(deck, 'utf8'), source)
  assert.equal(existsSync(resolve(dir, '.mdeck-backups')), false)
  assert.equal(migrateDeck(deck).length, 4)
  const after = readFileSync(deck, 'utf8'), config = parseSlides(after).deckConfig
  assert.equal(config.theme, 'neue'); assert.deepEqual(config.show, { organization: 'none' })
  assert.equal(config.session.code, '123456'); assert.equal(config.server, 'https://example.org')
  assert.ok(after.includes('meta: # untouched\r\n  title: "My talk"\r\n'))
  assert.equal(after.slice(after.indexOf('# Body')), source.slice(source.indexOf('# Body')))
  assert.equal(readFileSync(resolve(ext, 'extension.toml'), 'utf8'), toml.replace('"template"', '"layout"'))
  assert.equal(readFileSync(resolve(ext, 'layout.jsx'), 'utf8'), jsx.replace('from "mdeck/template-api"', 'from "mdeck/layout"'))
  assert.equal(readFileSync(resolve(dir, 'slides.drawings.json'), 'utf8'), '{"version":1}')
  assert.equal(existsSync(resolve(dir, 'slides.ink.json')), false)
  assert.deepEqual(migrateDeck(deck), [])
  assert.equal(loadRegistry(deck).layouts.custom.id, 'custom')
})

test('migration conflicts are detected before any changes', t => {
  const dir = fixture(t), deck = resolve(dir, 'slides.md')
  const source = '---\ndesign: neue\ntheme: terminal\n---\n# Talk\n'
  writeFileSync(deck, source)
  assert.throws(() => migrateDeck(deck), /Migration conflict: theme/)
  assert.equal(readFileSync(deck, 'utf8'), source)
  writeFileSync(deck, source.replace('theme: terminal\n', ''))
  writeFileSync(resolve(dir, 'slides.ink.json'), 'old')
  writeFileSync(resolve(dir, 'slides.drawings.json'), 'new')
  assert.throws(() => migrateDeck(deck), /both.*exist/)
  assert.equal(parseSlides(readFileSync(deck, 'utf8')).deckConfig.design, 'neue')
  assert.equal(existsSync(resolve(dir, '.mdeck-backups')), false)
})

test('API 2.0 registry envelope has its own schema version', () => {
  assert.equal(serializeRegistry(loadRegistry('slides.md')).schema, 2)
})
