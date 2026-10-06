import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseSlides } from '../src/core/parseSlides.js'
import { stripNotes } from '../src/core/editDeck.js'
import { deckOutline } from '../src/core/outline.js'
import { validateDeck } from '../src/core/validateDeck.js'
import { layoutManifests } from '../src/extensions/discover.js'
import { attachPdf } from '../src/build/pdf.js'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

test('stripNotes removes notes blocks but nothing else', () => {
  const source = '---\ntheme: neue\n---\n---\nlayout: title\n---\n# T\n\n:::notes\nsecret\n:::\n\n---\n:::meta\nlayout: focus\n:::\n# F\n\n:::notes\nmore\n:::\n\n:::notes\nagain\n:::\n\n---\n# Plain\n'
  const stripped = stripNotes(source)
  assert.equal(stripped, '---\ntheme: neue\n---\n---\nlayout: title\n---\n# T\n\n---\n:::meta\nlayout: focus\n:::\n# F\n\n---\n# Plain\n')
  const deck = parseSlides(stripped)
  assert.ok(deck.slides.every(slide => !slide.meta.notes))
  assert.equal(stripNotes('# No notes\n'), '# No notes\n')
  assert.equal(stripNotes('# Many notes\n' + ':::notes\nsecret\n:::\n'.repeat(12)), '# Many notes\n')
  assert.equal(stripNotes(':::notes\nsecret\n:::\n'), '')
  assert.equal(stripNotes(':::notes\nsecret\n:::\n---\n# Next\n\n:::notes\nmore\n:::\n'), '---\n# Next\n')
  for (const name of ['showcase', 'python', 'poll']) {
    const example = readFileSync(new URL(`../examples/${name}/slides.md`, import.meta.url), 'utf8')
    const before = parseSlides(example), after = parseSlides(stripNotes(example))
    assert.equal(after.slides.length, before.slides.length, name)
    assert.deepEqual(after.slides.map(s => s.content), before.slides.map(s => s.content), name)
    assert.ok(after.slides.every(slide => !slide.meta.notes), name)
    assert.deepEqual(validateDeck(after, { layouts: layoutManifests(`examples/${name}/slides.md`) }).filter(d => d.severity === 'error'), [], name)
  }
})

test('the outline names slides and marks chapters', () => {
  const deck = parseSlides('---\ntheme: neue\n---\n---\nlayout: title\n---\n# Welcome\n\n---\nlayout: chapter\npart: Part One\n---\n# Basics\n\n---\n# *Emphasis* stays plain\n\n---\n:::meta\nlayout: focus\n:::\n')
  const outline = deckOutline(deck, layoutManifests('examples/showcase/slides.md'))
  assert.deepEqual(outline.map(item => [item.title, item.chapter, item.part]), [['Welcome', false, null], ['Basics', true, 'Part One'], ['Emphasis stays plain', false, null], ['Big statement', false, null]])
  const noisy = parseSlides('```js\ncode\n```\n\nAfter the code\n---\n| a | b |\n|---|---|\n---\n<qrcode value="x" />\n')
  assert.deepEqual(deckOutline(noisy).map(item => item.title), ['After the code', 'Slide 2', 'Slide 3'])
  const named = parseSlides('---\ntheme: neue\n---\n---\ntitle: Network diagram\n---\n<netzwerk />\n')
  assert.deepEqual(deckOutline(named).map(item => item.title), ['Network diagram'])
  assert.deepEqual(validateDeck(parseSlides('---\ntheme: neue\n---\n---\ntitle: 3\n---\n# A')).map(d => d.code), ['invalid-metadata'])
})

test('reader settings are validated', () => {
  const codes = source => validateDeck(parseSlides(source)).map(d => [d.code, d.severity])
  assert.deepEqual(codes('---\nreader:\n  themes: false\n  notes: true\n---\n# A'), [])
  assert.deepEqual(codes('---\nreader: yes\n---\n# A'), [['invalid-config', 'error']])
  assert.deepEqual(codes('---\nreader:\n  themes: maybe\n  pdf: true\n---\n# A'), [['invalid-config', 'warning'], ['invalid-config', 'error']])
  assert.deepEqual(codes('---\nshare:\n  themes: false\n---\n# A'), [['renamed-setting', 'error']], 'the old name says what replaces it')
})

test('footer settings are validated, and the old names say what replaces them', () => {
  const codes = source => validateDeck(parseSlides(source)).map(d => [d.code, d.severity])
  assert.deepEqual(codes('---\nshow:\n  organization: all\n  author: none\n  numbers: slides\n  sections: none\n---\n# A'), [])
  assert.deepEqual(codes('---\nshow:\n  numbers: sometimes\n  colour: red\n---\n# A'), [['invalid-config', 'warning'], ['invalid-config', 'error']])
  assert.deepEqual(codes('---\ninstitution: none\npageNumbers: all\n---\n# A'), [['renamed-setting', 'error'], ['renamed-setting', 'error']])
})

test('speaker notes belong in body blocks rather than slide settings', () => {
  for (const key of ['note', 'notes']) {
    const deck = parseSlides(`:::meta\nlayout: focus\n${key}: metadata value\n:::\n# A\n\n:::notes\nBlock notes\n:::\n`)
    assert.deepEqual(validateDeck(deck).map(d => [d.code, d.severity]), [['invalid-metadata', 'error']])
    assert.equal(deck.slides[0].meta.notes, 'Block notes')
  }
})

test('a PDF link is attached to built HTML as a file link or embedded data', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'mdeck-share-'))
  const html = resolve(dir, 'index.html'), pdf = resolve(dir, 'deck.pdf')
  writeFileSync(html, '<!doctype html><html><head><title>x</title></head><body></body></html>')
  writeFileSync(pdf, '%PDF-1.4 fake')
  attachPdf(html, pdf)
  assert.match(readFileSync(html, 'utf8'), /<link rel="alternate" type="application\/pdf" href="deck.pdf"><\/head>/)
  attachPdf(html, pdf, { embed: true })
  const text = readFileSync(html, 'utf8')
  assert.equal((text.match(/rel="alternate"/g) ?? []).length, 1, 'an earlier link is replaced')
  assert.match(text, /href="data:application\/pdf;base64,JVBERi0xLjQgZmFrZQ=="/)
})
