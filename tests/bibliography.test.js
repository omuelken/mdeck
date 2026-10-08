import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createServer as createHttpServer } from 'node:http'
import { mkdtempSync, writeFileSync, rmSync, copyFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { scanCitations, parseLocator } from '../src/core/citations.js'
import { loadBibliography, formatBibliography, resolveBibliography } from '../src/build/bibliography.js'
import { slidesPlugin } from '../src/build/slidesPlugin.js'
import { parseSlides } from '../src/core/parseSlides.js'
import { validateDeck } from '../src/core/validateDeck.js'

const fixtures = resolve('tests/fixtures/bibliography')
const isKey = id => ['smith2020', 'jones2019'].includes(id)

test('citations are found in Pandoc syntax, with locators, prefixes and suppressed authors', () => {
  const found = scanCitations('As @smith2020 shows [see @smith2020, p. 12-14; @jones2019] and [-@jones2019, chap. 3].', { isKey })
  assert.deepEqual(found.map(c => c.raw), ['@smith2020', '[see @smith2020, p. 12-14; @jones2019]', '[-@jones2019, chap. 3]'])
  assert.equal(found[0].narrative, true)
  assert.deepEqual(found[1].items, [{ id: 'smith2020', prefix: 'see', label: 'page', locator: '12-14' }, { id: 'jones2019' }])
  assert.deepEqual(found[2].items, [{ id: 'jones2019', label: 'chapter', locator: '3', suppressAuthor: true }])
})

test('e-mail addresses, unknown handles, links, images and code are not citations', () => {
  const text = 'Write to me@smith2020.ch or @someone. [@smith2020](https://x) ![a](@smith2020) `[@smith2020]`\n```\n[@jones2019]\n```\n'
  assert.deepEqual(scanCitations(text, { isKey }), [])
})

test('a narrative citation takes a locator in brackets, and keys end before punctuation', () => {
  const [cluster] = scanCitations('See @smith2020 [S. 4].', { isKey })
  assert.equal(cluster.raw, '@smith2020 [S. 4]')
  assert.deepEqual(cluster.items, [{ id: 'smith2020', label: 'page', locator: '4' }])
  assert.equal(scanCitations('Thanks, @jones2019.', { isKey })[0].items[0].id, 'jones2019')
  assert.deepEqual(parseLocator(', emphasis added'), { suffix: ', emphasis added' })
})

test('BibTeX, CSL-JSON and Hayagriva load to the same references', async () => {
  const pick = item => ({ id: item.id, title: item.title, family: item.author.map(a => a.family), year: item.issued['date-parts'][0][0], container: item['container-title'] })
  const loaded = {}
  for (const ext of ['bib', 'json', 'yml']) {
    const { items, diagnostics } = await loadBibliography([resolve(fixtures, `refs.${ext}`)])
    assert.deepEqual(diagnostics, [])
    loaded[ext] = items.map(pick).map(item => ({ ...item, year: Number(item.year) }))
  }
  assert.deepEqual(loaded.bib, loaded.json)
  assert.deepEqual(loaded.yml, loaded.json)
  const [{ items }] = [await loadBibliography([resolve(fixtures, 'refs.yml')])]
  assert.equal(items[0].type, 'article-journal')
  assert.equal(items[0].DOI, '10.1000/xyz')
})

test('APA formats citations in the deck language, with the references in order', async () => {
  const { items } = await loadBibliography([resolve(fixtures, 'refs.json')])
  const result = await formatBibliography({ items, texts: ['As @smith2020 shows [@jones2019, p. 3]', '[@smith2020]'], csl: 'apa', lang: 'de' })
  assert.deepEqual(result.clusters, {
    '@smith2020': 'Smith et al. (2020)',
    '[@jones2019, p. 3]': '(Jones, 2019, S. 3)',
    '[@smith2020]': '(Smith et al., 2020)',
  })
  assert.deepEqual(result.order, ['jones2019', 'smith2020'])
  assert.match(result.entries.smith2020, /Smith, J\., Doe, J\., &#38; Roe, R\. \(2020\)\. A study of things/)
  assert.deepEqual(result.diagnostics, [])
})

test('numeric styles number the works by first citation', async () => {
  const { items } = await loadBibliography([resolve(fixtures, 'refs.json')])
  const result = await formatBibliography({ items, texts: ['[@jones2019]', '[@smith2020; @jones2019]'], csl: 'vancouver' })
  assert.equal(result.clusters['[@jones2019]'], '(1)')
  assert.equal(result.clusters['[@smith2020; @jones2019]'], '(1,2)')
  assert.deepEqual(result.order, ['jones2019', 'smith2020'])
  assert.match(result.entries.jones2019, /csl-left-margin">1\./)
})

test('works by the same author in the same year are told apart', async () => {
  const items = ['a', 'b'].map(id => ({ id, type: 'book', title: `Book ${id}`, author: [{ family: 'Smith', given: 'J' }], issued: { 'date-parts': [[2020]] } }))
  const result = await formatBibliography({ items, texts: ['[@a] [@b]'] })
  assert.deepEqual([result.clusters['[@a]'], result.clusters['[@b]']], ['(Smith, 2020a)', '(Smith, 2020b)'])
})

test('nocite adds works to the list, and problems are reported, not thrown', async () => {
  const { items } = await loadBibliography([resolve(fixtures, 'refs.json')])
  const result = await formatBibliography({ items, texts: ['[@smith2020] [@missing]'], nocite: ['jones2019', 'ghost'], csl: 'chicago', lang: 'tlh' })
  assert.deepEqual(result.order.sort(), ['jones2019', 'smith2020'])
  assert.deepEqual(result.diagnostics.map(d => d.code).sort(), ['citation-locale', 'citation-style', 'citation-unknown', 'citation-unknown'])
  const all = await formatBibliography({ items, texts: [], nocite: ['*'] })
  assert.equal(all.order.length, 2)
  const missing = await loadBibliography([resolve(fixtures, 'nope.bib')])
  assert.match(missing.diagnostics[0].message, /not found/)
})

test('a deck without a bibliography costs nothing', async () => {
  assert.equal(await resolveBibliography('slides.md', '# Hello @smith2020\n'), null)
})

test('bibliography, csl and nocite are deck settings, and show.citations is a switch', () => {
  const ok = parseSlides('---\nbibliography: refs.bib\ncsl: apa\nnocite: [a]\nshow:\n  citations: false\n---\n# A\n')
  assert.deepEqual(validateDeck(ok), [])
  const bad = parseSlides('---\nbibliography: 3\ncsl: [x]\nnocite: a\nshow:\n  citations: maybe\n---\n# A\n')
  assert.equal(validateDeck(bad).filter(d => d.severity === 'error').length, 4)
})

test('the bibliography module follows edits to the reference file', async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'mdeck-bib-reload-'))
  const deck = resolve(dir, 'slides.md')
  writeFileSync(deck, '---\nbibliography: refs.bib\n---\n# Slide\n\nSee [@jones2019].\n')
  copyFileSync(resolve(fixtures, 'refs.bib'), resolve(dir, 'refs.bib'))
  const server = await createServer({
    configFile: false, root: dir, plugins: [slidesPlugin(deck)], appType: 'custom',
    cacheDir: resolve(dir, 'cache'), optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: { server: createHttpServer() } }, logLevel: 'silent',
  })
  const module = async () => (await server.transformRequest('virtual:bibliography')).code
  try {
    assert.match(await module(), /\(Jones, 2019\)/)
    writeFileSync(resolve(dir, 'refs.bib'), '@book{jones2019, author={Jones, Alice}, title={Counting sheep}, publisher={Wiley}, year={2021}}\n')
    const deadline = Date.now() + 5000
    while (!/\(Jones, 2021\)/.test(await module())) {
      if (Date.now() > deadline) assert.fail('the bibliography module did not follow the edited reference file')
      await delay(25)
    }
  } finally {
    await server.close()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a citation that mixes a known and an unknown key keeps the known work, in every style', async () => {
  const { items } = await loadBibliography([resolve(fixtures, 'refs.json')])
  for (const csl of ['vancouver', 'apa']) {
    const result = await formatBibliography({ items, texts: ['[@jones2019; @nobody]'], csl })
    assert.ok(result.clusters['[@jones2019; @nobody]'], csl)
    assert.deepEqual(result.order, ['jones2019'], csl)
    assert.deepEqual(result.diagnostics.map(d => d.code), ['citation-unknown'], csl)
  }
})

test('an @ inside a word in brackets is not a citation; a colon or footnote may follow one', () => {
  assert.deepEqual(scanCitations('Write to [info@fhnw.ch] or [me @ home].', { isKey }), [])
  assert.deepEqual(scanCitations('Two findings [@smith2020]: first [@jones2019][^1]', { isKey }).map(c => c.raw), ['[@smith2020]', '[@jones2019]'])
  assert.deepEqual(scanCitations('[@smith2020]: https://example.com', { isKey }), [])
})

test("Hayagriva keeps the publisher's place", async () => {
  const { hayagrivaToCsl } = await import('../src/build/bibliography.js')
  const [item] = hayagrivaToCsl({ a: { type: 'Book', title: 'T', publisher: { name: 'P', location: 'Basel' } } })
  assert.deepEqual([item.publisher, item['publisher-place']], ['P', 'Basel'])
})
