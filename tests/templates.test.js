import test from 'node:test'
import assert from 'node:assert/strict'
import { discoverTemplates, templateManifests, validateTemplateManifest } from '../src/build/discoverTemplates.js'
import { builtinManifests, resolveTemplateProps } from '../src/templates/templateManifests.js'
import { parseSlides } from '../src/core/parseSlides.js'
import { validateDeck } from '../src/core/validateDeck.js'

const path = 'examples/custom-templates/slides.md'
const templates = templateManifests(path)

test('discovery combines built-ins with local metadata, CSS and starter Markdown', () => {
  const local = discoverTemplates(path)
  assert.equal(local.length, 1)
  assert.ok(local[0].styles.endsWith('styles.css'))
  assert.ok(local[0].layout.endsWith('layout.jsx'))
  assert.equal(Object.keys(templates).length, Object.keys(builtinManifests).length + 1)
  for (const manifest of Object.values(templates)) {
    assert.deepEqual(validateDeck(parseSlides(manifest.starter), { templates }), [], manifest.name)
  }
})

test('template validation rejects missing regions, unknown props and incorrect values', () => {
  const source = ':::meta\nlayout: comparison\nprops:\n  ratio: [1, 0]\n  emphasis: purple\n  typo: true\n:::\n:::slot wrong\nContent\n:::'
  const diagnostics = validateDeck(parseSlides(source), { templates })
  for (const code of ['missing-region', 'unknown-region', 'invalid-property', 'unknown-property']) assert.ok(diagnostics.some(d => d.code === code), code)
  assert.ok(diagnostics.some(d => d.message.includes('props.ratio[1]')))
})

test('defaults are typed, isolated per slide and support legacy image fields', () => {
  const one = resolveTemplateProps(templates.comparison)
  one.ratio[0] = 100
  assert.deepEqual(resolveTemplateProps(templates.comparison).ratio, [1, 1])
  assert.equal(resolveTemplateProps(templates['image-text'], { image: 'legacy.jpg' }).image, 'legacy.jpg')
  assert.equal(resolveTemplateProps(templates['image-text'], { image: 'legacy.jpg', props: { image: 'new.jpg' } }).image, 'new.jpg')
})

test('invalid manifests fail with a filename and reason', () => {
  const original = templates.comparison
  for (const manifest of [
    { ...original, name: 'different' },
    { ...original, regions: {} },
    { ...original, properties: { value: { type: 'banana' } } },
    { ...original, properties: { value: { type: 'number', default: 'wrong' } } },
  ]) assert.throws(() => validateTemplateManifest(manifest, 'template.json', 'comparison'), /template.json:/)
  assert.throws(() => validateTemplateManifest({ ...original, name: 'title' }, 'template.json', 'title'), /Cannot shadow/)
})
