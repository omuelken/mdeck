import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseSlides } from '../src/core/parseSlides.js'
import { patchYamlMapping, normalizeBlock, firstYamlKey } from '../src/core/source.js'
import { validateDeck } from '../src/core/validateDeck.js'
import { layoutManifests } from '../src/extensions/discover.js'
import {
  setRegion, removeRegion, setSlideMeta, setSlideNotes, notesSource, setDeckConfig,
  insertSlide, removeSlide, moveSlide, replaceSlideSource, slideBounds, slideSourceText,
} from '../src/core/editDeck.js'

const crlf = '---\r\ntheme: neue\r\n---\r\n\r\n---\r\n:::meta\r\nlayout: split\r\nid: compare\r\n# preserve this comment\r\n:::\r\n# Compare\r\n\r\n:::slot left\r\n**Before**\r\n:::\r\n\r\n:::slot right\r\n:::tip\r\nAfter\r\n:::\r\n:::\r\n'
const legacy = '---\ntheme: neue\n---\n---\nlayout: title\nimage: ./a.jpg\n---\n# T\n\n---\nlayout: focus\neyebrow: e\n---\n# F\n\n:::notes\nn\n:::\n\n---\n# Plain\n'
const shared = '---\ntheme: neue\n---\n# First\n\n---\n# Second\n'
const plain = '# First\nHello\n---\nNote: body text'
const parse = parseSlides
const clean = (source, name) => { const deck = parse(source); assert.deepEqual(deck.diagnostics, [], name); return deck }

test('yaml patching rewrites only the touched keys', () => {
  assert.equal(patchYamlMapping('layout: split\r\nid: compare\r\n# preserve this comment\r\n', { layout: 'title', props: { ratio: [1, 2], emphasis: 'right' } }),
    'layout: title\r\nid: compare\r\n# preserve this comment\r\nprops:\r\n  ratio: [1, 2]\r\n  emphasis: right\r\n')
  assert.equal(patchYamlMapping('a: 1\n# about b\nb:\n  c: 2\n  # inner\n  d: 3\ne: 4\n', { b: { c: 9 } }), 'a: 1\n# about b\nb:\n  c: 9\ne: 4\n')
  assert.equal(patchYamlMapping('a: 1\nb: 2\n', { a: undefined }), 'b: 2\n')
  assert.equal(patchYamlMapping('a: 1\n', { a: undefined }), '')
  assert.equal(patchYamlMapping('', { date: '2026-05-13', title: 'It\'s #1' }), 'date: "2026-05-13"\ntitle: "It\'s #1"\n')
  assert.equal(patchYamlMapping('custom: true\nlayout: focus\n', { custom: false }, { leadKeys: new Set(['layout']) }), 'layout: focus\ncustom: false\n')
  assert.equal(firstYamlKey('# c\n\nlayout: x\n'), 'layout')
  assert.throws(() => patchYamlMapping('- item\n', { a: 1 }), /mapping/)
  assert.throws(() => patchYamlMapping('', { 'bad key': 1 }), /Invalid metadata key/)
  assert.equal(normalizeBlock('a\r\nb\n\n', '\n'), 'a\nb\n')
  assert.equal(normalizeBlock('  \n', '\n'), '')
})

test('regions: explicit, discontiguous body, missing and removed', () => {
  const deck = clean(crlf)
  assert.equal(setRegion(deck, 'compare', 'left', '- New\n- Content'), crlf.replace('**Before**\r\n', '- New\r\n- Content\r\n'))
  assert.equal(setRegion(deck, 'compare', 'body', '# Changed'), crlf.replace('# Compare\r\n', '# Changed\r\n'))
  const gap = '---\n:::meta\nlayout: split\n:::\n# A\n\n:::slot left\nL\n:::\n\nMore\n\n---\n# B\n'
  assert.equal(setRegion(clean(gap), 'slide-1', 'body', '# New'), '---\n:::meta\nlayout: split\n:::\n# New\n\n:::slot left\nL\n:::\n\n---\n# B\n')
  assert.equal(setRegion(clean(gap), 'slide-1', 'body', ''), '---\n:::meta\nlayout: split\n:::\n\n:::slot left\nL\n:::\n\n---\n# B\n')
  assert.equal(setRegion(clean(gap), 'slide-1', 'right', 'R'), '---\n:::meta\nlayout: split\n:::\n# A\n\n:::slot left\nL\n:::\n\nMore\n\n:::slot right\nR\n:::\n\n---\n# B\n')
  assert.equal(removeRegion(clean(gap), 'slide-1', 'left'), '---\n:::meta\nlayout: split\n:::\n# A\n\nMore\n\n---\n# B\n')
  assert.equal(setRegion(clean(plain), 'slide-2', 'body', 'Changed'), '# First\nHello\n---\nChanged')
  assert.equal(setRegion(clean(plain), 'slide-1', 'body', 'One\ntwo'), 'One\ntwo\n---\nNote: body text')
  const metaOnly = '---\nlayout: title\n---\nlayout: focus\n---\n# F\n'
  assert.equal(setRegion(clean(metaOnly), 'slide-1', 'body', '# T'), '---\nlayout: title\n---\n# T\n\n---\nlayout: focus\n---\n# F\n')
  const emptyBody = ':::meta\nlayout: split\n:::\n:::slot left\nL\n:::\n'
  assert.equal(setRegion(clean(emptyBody), 'slide-1', 'body', '# Head'), ':::meta\nlayout: split\n:::\n# Head\n\n:::slot left\nL\n:::\n')
  assert.throws(() => setRegion(deck, 'compare', 'Bad Name', 'x'), /Invalid region name/)
  assert.throws(() => setRegion(deck, 'nope', 'body', 'x'), /No slide "nope"/)
})

test('slide metadata: explicit, legacy, conversion and insertion', () => {
  const deck = clean(crlf)
  assert.equal(setSlideMeta(deck, 'compare', { layout: 'title' }), crlf.replace('layout: split', 'layout: title'))
  assert.equal(setSlideMeta(deck, 'compare', { layout: undefined, id: undefined }), crlf.replace(':::meta\r\nlayout: split\r\nid: compare\r\n# preserve this comment\r\n:::\r\n', ''))
  const l = clean(legacy)
  assert.equal(setSlideMeta(l, 'slide-1', { image: undefined }), legacy.replace('image: ./a.jpg\n', ''))
  assert.equal(setSlideMeta(l, 'slide-1', { layout: undefined, image: undefined, custom: 1 }), legacy.replace('layout: title\nimage: ./a.jpg\n---\n', ':::meta\ncustom: 1\n:::\n'))
  assert.equal(setSlideMeta(l, 'slide-1', { layout: undefined, image: undefined }), legacy.replace('layout: title\nimage: ./a.jpg\n---\n', ''))
  assert.equal(setSlideMeta(l, 'slide-3', { layout: 'focus' }), legacy.replace('# Plain\n', ':::meta\nlayout: focus\n:::\n# Plain\n'))
  const converted = parse(setSlideMeta(l, 'slide-1', { layout: undefined, image: undefined, custom: 1 }))
  assert.deepEqual(converted.diagnostics, [])
  assert.deepEqual(converted.slides[0].authoredMeta, { custom: 1 })
  assert.equal(converted.slides[0].content, '# T')
  const metaOnly = clean('---\nlayout: title\n---\nlayout: focus\n---\n# F\n')
  assert.equal(setSlideMeta(metaOnly, 'slide-1', { layout: undefined }), '---\nlayout: focus\n---\n# F\n')
})

test('notes blocks are edited, removed or appended', () => {
  const l = clean(legacy)
  assert.equal(notesSource(l, 'slide-2'), 'block')
  assert.equal(notesSource(l, 'slide-1'), null)
  assert.equal(setSlideNotes(l, 'slide-2', 'new note'), legacy.replace(':::notes\nn\n:::', ':::notes\nnew note\n:::'))
  assert.equal(setSlideNotes(l, 'slide-2', ''), legacy.replace('# F\n\n:::notes\nn\n:::\n', '# F\n'))
  assert.equal(setSlideNotes(l, 'slide-1', 'hi'), legacy.replace('# T\n\n---', '# T\n\n:::notes\nhi\n:::\n\n---'))
  assert.equal(setSlideNotes(l, 'slide-1', ''), legacy)
  assert.equal(parse(setSlideNotes(l, 'slide-1', 'hi')).slides[0].meta.notes, 'hi')
})

test('deck settings are patched in place or inserted', () => {
  assert.equal(setDeckConfig(clean(crlf), { palette: 'sage' }), crlf.replace('theme: neue\r\n', 'theme: neue\r\npalette: sage\r\n'))
  assert.equal(setDeckConfig(clean(plain), { theme: 'neue' }), '---\ntheme: neue\n---\n\n# First\nHello\n---\nNote: body text')
  assert.equal(setDeckConfig(clean(shared), { theme: undefined }), '# First\n\n---\n# Second\n')
  assert.equal(setDeckConfig(clean(legacy), { theme: undefined }), legacy.replace('---\ntheme: neue\n---\n', ''))
  assert.equal(setDeckConfig(clean(plain), {}), plain)
  const inserted = parse(setDeckConfig(clean(legacy.replace('---\ntheme: neue\n---\n', '')), { theme: 'duet', meta: { title: 'T' } }))
  assert.deepEqual(inserted.deckConfig, { theme: 'duet', meta: { title: 'T' } })
  assert.equal(inserted.slides.length, 3)
})

test('slides can be inserted, removed and moved without disturbing neighbours', () => {
  const l = clean(legacy)
  assert.deepEqual(slideBounds(l, 'slide-1'), { start: 24, end: 62, delimiterStart: 20 })
  assert.equal(slideBounds(clean(shared), 'slide-1').delimiterStart, null)
  assert.equal(slideSourceText(l, 'slide-3'), '# Plain\n')
  assert.deepEqual(removeSlide(l, 'slide-1'), { source: legacy.replace('layout: title\nimage: ./a.jpg\n---\n# T\n\n---\n', ''), index: 0 })
  assert.deepEqual(removeSlide(l, 'slide-3'), { source: legacy.replace('---\n# Plain\n', ''), index: 1 })
  assert.deepEqual(removeSlide(clean(shared), 'slide-1'), { source: '---\ntheme: neue\n---\n# Second\n', index: 0 })
  assert.deepEqual(removeSlide(clean(shared), 'slide-2'), { source: '---\ntheme: neue\n---\n# First\n\n', index: 0 })
  assert.deepEqual(removeSlide(clean(plain), 'slide-1'), { source: 'Note: body text', index: 0 })
  assert.deepEqual(removeSlide(clean('# Only\n'), 'slide-1'), { source: '', index: -1 })
  assert.deepEqual(insertSlide(clean(plain), 2, '# Third'), { source: '# First\nHello\n---\nNote: body text\n---\n# Third\n', index: 2 })
  assert.deepEqual(insertSlide(clean(plain), 0, '# Zero'), { source: '# Zero\n\n---\n# First\nHello\n---\nNote: body text', index: 0 })
  assert.deepEqual(insertSlide(clean(shared), 1, ':::meta\nlayout: focus\n:::\n# Mid\n'), { source: '---\ntheme: neue\n---\n# First\n\n---\n:::meta\nlayout: focus\n:::\n# Mid\n\n---\n# Second\n', index: 1 })
  assert.deepEqual(insertSlide(clean('---\ntheme: neue\n---\n'), 5, '# A'), { source: '---\ntheme: neue\n---\n---\n# A\n', index: 0 })
  assert.deepEqual(insertSlide(clean(''), 0, '# A'), { source: '---\n# A\n', index: 0 })
  assert.equal(parse(insertSlide(clean(''), 0, '# A').source).slides.length, 1)
  const moved = moveSlide(l, 'slide-3', 0)
  assert.equal(moved.index, 0)
  assert.equal(moved.source, '---\ntheme: neue\n---\n---\n# Plain\n\n---\nlayout: title\nimage: ./a.jpg\n---\n# T\n\n---\nlayout: focus\neyebrow: e\n---\n# F\n\n:::notes\nn\n:::\n\n')
  assert.deepEqual(parse(moved.source).slides.map(s => s.content), ['# Plain', '# T', '# F'])
  assert.deepEqual(parse(moveSlide(l, 'slide-1', 2).source).slides.map(s => s.content), ['# F', '# Plain', '# T'])
  assert.equal(replaceSlideSource(clean(shared), 'slide-1', '# Uno\nmore'), '---\ntheme: neue\n---\n# Uno\nmore\n\n---\n# Second\n')
  assert.equal(replaceSlideSource(clean(plain), 'slide-2', 'X'), '# First\nHello\n---\nX')
})

test('inserting and removing a slide at any position restores the original bytes', () => {
  for (const name of ['custom-layouts', 'showcase', 'python', 'poll']) {
    const source = readFileSync(new URL(`../examples/${name}/slides.md`, import.meta.url), 'utf8')
    const deck = clean(source, name)
    for (let index = 0; index <= deck.slides.length; index++) {
      const inserted = insertSlide(deck, index, ':::meta\nlayout: focus\nid: probe\n:::\n# Probe\n')
      const between = parse(inserted.source)
      assert.equal(between.slides[index].id, 'probe', `${name} ${index}`)
      assert.equal(between.slides.length, deck.slides.length + 1)
      assert.equal(removeSlide(between, 'probe').source, source, `${name} ${index}`)
    }
  }
})

test('every helper keeps the example decks valid', () => {
  const path = 'examples/custom-layouts/slides.md'
  const layouts = layoutManifests(path)
  let deck = clean(readFileSync(path, 'utf8'))
  const check = source => { deck = parse(source); assert.deepEqual(validateDeck(deck, { layouts }), []) }
  check(setRegion(deck, 'deployment-options', 'left', '## Left\n\nChanged'))
  check(setSlideMeta(deck, 'deployment-options', { props: { ratio: [1, 1], emphasis: 'left' }, section: 'Intro' }))
  check(setSlideNotes(deck, 'built-in-regions', 'Remember to pause.'))
  check(setDeckConfig(deck, { palette: 'graphite', appearance: 'dark' }))
  check(insertSlide(deck, 1, layouts.split.starter).source)
  check(moveSlide(deck, 'built-in-regions', 0).source)
  assert.equal(deck.slides.length, 3)
  assert.equal(deck.slides[1].regions.left.content, '## Left\n\nChanged')
  assert.deepEqual(deck.deckConfig, { theme: 'neue', meta: { title: 'Deck-local layouts' }, palette: 'graphite', appearance: 'dark' })
})
