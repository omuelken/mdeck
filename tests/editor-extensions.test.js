import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseManifest, toModel, toToml, toRuntimeManifest, starterFiles } from '../src/editor/extensions.js'
import { validateManifest } from '../src/extensions/manifest.js'
import { loadRegistry } from '../src/extensions/discover.js'

const registry = loadRegistry('examples/custom-layouts/slides.md')
const exists = () => true

test('every built-in manifest round-trips through the editor model', () => {
  for (const record of registry.records) {
    const text = readFileSync(record.file, 'utf8')
    const { raw, error } = parseManifest(text)
    assert.equal(error, undefined, record.file)
    const model = toModel(raw)
    const again = parseManifest(toToml(model)).raw
    const before = validateManifest(raw, { file: record.file, dir: record.dir, folderName: record.id, fileExists: exists })
    const after = validateManifest(again, { file: record.file, dir: record.dir, folderName: record.id, fileExists: exists })
    const strip = m => JSON.parse(JSON.stringify(m))
    assert.deepEqual(strip(after.manifest), strip(before.manifest), record.id)
    if (record.kind !== 'layout') assert.deepEqual(toRuntimeManifest(model), strip(before.manifest), record.id)
  }
})

test('starter files for new extensions validate', () => {
  for (const [kind, from] of [['palette', null], ['palette', registry.palettes.paper.manifest], ['theme', registry.themes.glass.manifest]]) {
    const files = starterFiles(kind, 'fresh', 'Fresh', from, { 'styles.css': '.slide {}' })
    const record = validateManifest(parseManifest(files['extension.toml']).raw, { file: 'x', dir: '/x/fresh', folderName: 'fresh', fileExists: path => Object.hasOwn(files, path.slice('/x/fresh/'.length)) })
    assert.equal(record.kind, kind)
    assert.equal(record.title, 'Fresh')
    if (kind === 'theme') assert.equal(record.manifest.palette, 'nordic', 'a copy keeps the default palette')
    if (kind === 'palette' && from) assert.equal(record.manifest.dark['--accent'], '#fb8c4a', 'a copy keeps both variants')
  }
  assert.throws(() => starterFiles('theme', 'fresh', 'Fresh'), /copy/)
  assert.match(parseManifest('id = \n').error, /value expected|invalid value/)
})

