import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { parseSlides, includeOf } from '../src/core/parseSlides.js'
import { validateDeck } from '../src/core/validateDeck.js'
import { expandDeck, withoutSettings } from '../src/build/include.js'
import { createTimingFile } from '../src/build/timingPlugin.js'
import { createInkFile } from '../src/build/inkPlugin.js'
import { checkDeck } from '../src/build/check.js'
import { loadRegistry } from '../src/extensions/discover.js'

// A folder of files: { 'course.md': '…', 'lectures/graphs.md': '…' }.
function folder(files) {
  const dir = mkdtempSync(resolve(tmpdir(), 'mdeck-include-'))
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(resolve(dir, name, '..'), { recursive: true })
    writeFileSync(resolve(dir, name), text)
  }
  return dir
}
const headings = source => parseSlides(source).slides.map(slide => slide.content.match(/^# (.+)$/m)?.[1] ?? slide.content.trim())

const LECTURE = '---\ntheme: duet\ntime: 20m\n---\n\n# Graphs\n\n![A graph](./img/g.svg)\n\n---\n:::meta\nid: dijkstra\n:::\n# Dijkstra\n\n<img src="img/g.svg">\n\n---\n# Trees\n'
const COURSE = '---\ntheme: neue\n---\n\n# Welcome\n\n---\n\n:::include ./lectures/02-graphs.md\n\n---\n# Thanks\n'

test(':::include is one line: the slides after it stay slides', () => {
  const deck = parseSlides(COURSE)
  assert.deepEqual(deck.slides.map(slide => slide.id), ['slide-1', 'slide-2', 'slide-3'])
  assert.deepEqual(deck.slides[1].include, { file: './lectures/02-graphs.md', slides: null, options: {} })
  assert.deepEqual(includeOf(':::include "my lecture.md" slides=2-4'), { file: 'my lecture.md', slides: '2-4', options: { slides: '2-4' } })
  assert.equal(includeOf('# A\n\n:::include ./x.md'), null, 'only alone on its slide')
  assert.deepEqual(validateDeck(deck).map(d => d.code), [])
  assert.deepEqual(validateDeck(parseSlides('# A\n\n:::include ./x.md\n')).map(d => d.code), ['misplaced-include'])
  // A callout of the deck's own named include still opens and closes.
  assert.deepEqual(parseSlides('---\ncallouts:\n  include: Included\n---\n\n:::include\nText\n:::\n\n---\n# B\n').slides.length, 2)
})

test('the included slides take its place, without its settings, paths from the deck’s folder', () => {
  const dir = folder({ 'course.md': COURSE, 'lectures/02-graphs.md': LECTURE })
  const { source, files, diagnostics, origins } = expandDeck(resolve(dir, 'course.md'))
  assert.deepEqual(diagnostics, [])
  assert.deepEqual(files, [resolve(dir, 'lectures/02-graphs.md')])
  const deck = parseSlides(source)
  assert.equal(deck.deckConfig.theme, 'neue', 'the deck’s own settings')
  assert.equal(deck.deckConfig.time, undefined, 'not the included file’s')
  assert.deepEqual(headings(source), ['Welcome', 'Graphs', 'Dijkstra', 'Trees', 'Thanks'])
  assert.match(source, /!\[A graph\]\(lectures\/img\/g\.svg\)/)
  assert.match(source, /<img src="lectures\/img\/g\.svg">/)
  // The deck's own slides keep the ids they have in it; included ones get the file's name.
  assert.deepEqual(deck.slides.map(slide => slide.id), ['slide-1', 'graphs-slide-1', 'graphs-dijkstra', 'graphs-slide-3', 'slide-3'])
  assert.deepEqual(origins['graphs-dijkstra'], { file: resolve(dir, 'lectures/02-graphs.md'), id: 'dijkstra' })
  assert.deepEqual(origins['slide-3'], { file: resolve(dir, 'course.md'), id: 'slide-3' })
})

test('a deck without includes is read as it is', () => {
  const dir = folder({ 'talk.md': '# A\n\n---\n# B\n' })
  assert.deepEqual(expandDeck(resolve(dir, 'talk.md')), { source: '# A\n\n---\n# B\n', files: [], origins: null, diagnostics: [] })
})

test('slides= keeps some, counted as the file shows them; the same file twice has ids of its own', () => {
  const dir = folder({ 'course.md': COURSE.replace('# Thanks', ':::include ./lectures/02-graphs.md slides=2-3'), 'lectures/02-graphs.md': LECTURE })
  const { source } = expandDeck(resolve(dir, 'course.md'))
  assert.deepEqual(headings(source), ['Welcome', 'Graphs', 'Dijkstra', 'Trees', 'Dijkstra', 'Trees'])
  assert.deepEqual(parseSlides(source).slides.slice(4).map(slide => slide.id), ['graphs-2-dijkstra', 'graphs-2-slide-3'])
})

test('includes nest, and paths stay right at every level', () => {
  const dir = folder({
    'course.md': '# Course\n\n---\n:::include ./part/one.md\n',
    'part/one.md': '# One\n\n---\n:::include ./deeper/two.md\n',
    'part/deeper/two.md': '# Two\n\n![x](pic.png)\n',
  })
  const { source, files } = expandDeck(resolve(dir, 'course.md'))
  assert.deepEqual(headings(source), ['Course', 'One', 'Two'])
  assert.match(source, /!\[x\]\(part\/deeper\/pic\.png\)/)
  assert.equal(files.length, 2)
  assert.ok(parseSlides(source).slides.some(slide => slide.id === 'one-two-slide-1'))
})

test('a missing file, a loop and slides beyond the file are reported where the include is written', () => {
  const dir = folder({
    'course.md': '# A\n\n---\n:::include ./gone.md\n\n---\n:::include ./loop.md\n\n---\n:::include ./loop.md slides=7\n',
    'loop.md': '# Loop\n\n---\n:::include ./course.md\n',
  })
  const { diagnostics } = expandDeck(resolve(dir, 'course.md'))
  assert.deepEqual(diagnostics.map(d => [d.code, d.line]), [['missing-include', 4], ['include-loop', 4], ['include-loop', 4], ['invalid-include', 10]])
  assert.match(diagnostics[1].message, /course\.md → loop\.md → course\.md/)
})

test('a deck in another language takes the included file’s twin in that language', () => {
  const dir = folder({ 'course.de.md': '# Kurs\n\n---\n:::include ./graphs.md\n', 'graphs.md': '# Graphs\n', 'graphs.de.md': '# Graphen\n' })
  assert.deepEqual(headings(expandDeck(resolve(dir, 'course.de.md')).source), ['Kurs', 'Graphen'])
})

test('an included file’s settings are not the deck’s problem', () => {
  const diagnostics = [{ code: 'unknown-theme', offset: 5 }, { code: 'unknown-layout', offset: 40 }]
  assert.deepEqual(withoutSettings('---\ntheme: nope\n---\n\n# A slide with a bad layout\n', diagnostics).map(d => d.code), ['unknown-layout'])
  const dir = folder({ 'course.md': COURSE, 'lectures/02-graphs.md': LECTURE.replace('# Trees', ':::meta\nlayout: nope\n:::\n# Trees') })
  const { diagnostics: found } = checkDeck(resolve(dir, 'course.md'), loadRegistry(resolve(dir, 'course.md')))
  // Its own problems name it, with their lines in it: here a layout and a picture it lacks.
  assert.deepEqual(found.map(d => [d.code, d.line, d.file?.endsWith('02-graphs.md')]), [['unknown-layout', 20, true], ['missing-asset', 1, true], ['missing-asset', 1, true]])
  assert.ok(!found.some(d => d.code === 'unknown-theme'), 'duet need not be installed for the course')
})

test('a rehearsal’s times go into the file each slide is written in', () => {
  const dir = folder({ 'course.md': COURSE, 'lectures/02-graphs.md': LECTURE })
  const file = createTimingFile(resolve(dir, 'course.md'))
  const ids = file.ids()
  assert.equal(file.save(ids, { 'slide-1': '30s', 'graphs-dijkstra': '2m' }).changed, 2)
  assert.match(readFileSync(resolve(dir, 'course.md'), 'utf8'), /time: 30s/)
  const lecture = readFileSync(resolve(dir, 'lectures/02-graphs.md'), 'utf8')
  assert.match(lecture, /id: dijkstra\ntime: 2m/)
  assert.doesNotMatch(lecture, /graphs-dijkstra/, 'the lecture keeps its own ids')
})

test('drawings on an included slide are kept under its id, without writing into any deck', () => {
  const dir = folder({ 'course.md': COURSE, 'lectures/02-graphs.md': LECTURE })
  const course = resolve(dir, 'course.md')
  const before = [readFileSync(course, 'utf8'), readFileSync(resolve(dir, 'lectures/02-graphs.md'), 'utf8')]
  const ink = createInkFile(course, { debounceMs: 5 })
  const stroke = { id: 'a:1', tool: 'pen', color: '#e11d48', size: 6, points: [[10, 10, 0.5], [90, 40, 0.6]] }
  const result = ink.apply([{ type: 'add', slideId: 'graphs-slide-3', stroke }], ink.read().deckHash)
  assert.equal(result.status, 200)
  assert.deepEqual(result.renamed, [])
  ink.flush()
  assert.deepEqual([readFileSync(course, 'utf8'), readFileSync(resolve(dir, 'lectures/02-graphs.md'), 'utf8')], before)
  assert.deepEqual(Object.keys(ink.read().ink.slides), ['graphs-slide-3'])
})
