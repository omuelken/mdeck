import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseManifest, toModel, toToml, toRuntimeManifest, starterFiles, deckHeader } from '../src/editor/extensions.js'
import { validateManifest } from '../src/extensions/manifest.js'
import { loadRegistry } from '../src/extensions/discover.js'
import { parseSlides } from '../src/core/parseSlides.js'

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
  for (const [kind, from] of [['palette', null], ['palette', registry.palettes.forest.manifest], ['theme', null], ['theme', registry.themes.duet.manifest], ['layout', null], ['layout', registry.layouts.split.manifest]]) {
    const files = starterFiles(kind, 'fresh', 'Fresh', from, { 'styles.css': '.slide {}', 'layout.jsx': 'export default () => null', 'starter.md': ':::meta\nlayout: split\n:::\n# X\n' })
    const record = validateManifest(parseManifest(files['extension.toml']).raw, { file: 'x', dir: '/x/fresh', folderName: 'fresh', fileExists: path => Object.hasOwn(files, path.slice('/x/fresh/'.length)) })
    assert.equal(record.kind, kind)
    assert.equal(record.title, 'Fresh')
    if (kind === 'layout') assert.match(files['starter.md'], /layout: fresh/)
    if (kind === 'theme' && from) assert.equal(record.manifest.palette, 'cobalt', 'a copy keeps the default palette')
    if (kind === 'palette' && from) assert.equal(record.manifest.dark['--accent'], '#7bd389', 'a copy keeps both variants')
  }
  assert.match(parseManifest('id = \n').error, /value expected|invalid value/)
})

test('the preview source for a template starts with the deck settings', () => {
  const deck = parseSlides('---\ntheme: neue\n---\n\n---\n# One\n')
  assert.equal(deckHeader(deck), '---\ntheme: neue\n---\n')
  assert.equal(deckHeader(parseSlides('# One\n')), '')
})
