import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import preact from '@preact/preset-vite'
import { createServer as createHttpServer } from 'node:http'
import { mkdtempSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, basename } from 'node:path'
import { slidesPlugin } from '../src/build/slidesPlugin.js'
import { editorPlugin } from '../src/build/editorPlugin.js'
import { starterFiles } from '../src/editor/extensions.js'
import { designUrl, parseTarget, DESIGN_URL } from '../src/editor/designLink.js'
import { sampleDeck, sampleDataUrl } from '../src/editor/sampleDeck.js'
import { parseSlides } from '../src/core/parseSlides.js'

test('links to the design page carry what to open or copy, and read back', () => {
  assert.equal(designUrl(), DESIGN_URL)
  const copy = new URL(designUrl({ copy: 'theme:sketch' }), 'http://localhost')
  assert.deepEqual(parseTarget(copy.searchParams.get('copy')), { kind: 'theme', id: 'sketch' })
  const open = new URL(designUrl({ open: 'palette:my-colours' }), 'http://localhost')
  assert.deepEqual(parseTarget(open.searchParams.get('open')), { kind: 'palette', id: 'my-colours' })
  for (const value of [null, '', 'theme', 'font:x', 'theme:../x', 'theme:Upper']) assert.equal(parseTarget(value), null)
})

test('the sample deck parses cleanly and uses every built-in layout', () => {
  const deck = parseSlides(sampleDeck('data:image/svg+xml,x'))
  assert.deepEqual(deck.diagnostics.filter(d => d.severity === 'error'), [])
  const layouts = new Set(deck.slides.map(slide => slide.meta.layout ?? 'generic'))
  for (const layout of ['title', 'chapter', 'generic', 'focus', 'image-text', 'split', 'full-bleed-image']) assert.ok(layouts.has(layout), layout)
  assert.ok(!sampleDeck('data:image/svg+xml,x').includes('./picture.svg'))
})

test('the sample deck shows a link, a quote, a list nested in a numbered list, and citations', () => {
  const source = sampleDeck()
  for (const [what, pattern] of [['link', /\]\(https:/], ['quote', /^> /m], ['nested list', /^\d+\. .*\n(?:\d+\. .*\n)*\s+- /m], ['citation', /\[@\w+/], ['narrative citation', / @roe2023 /], ['reference list', /<bibliography \/>/]]) assert.match(source, pattern, what)
})

// `mdeck design` on a folder without a deck: the sample deck is served from
// memory, extensions are written to the folder, and nothing else is.
const folder = mkdtempSync(resolve(tmpdir(), 'mdeck-design-'))
const abs = resolve(folder, 'design.md')
const source = sampleDeck(sampleDataUrl())
const vite = await createServer({ configFile: false, root: resolve('src/runtime'), plugins: [preact(), slidesPlugin(abs, { editor: true, source, ink: false }), editorPlugin(abs, { source })], server: { middlewareMode: true, hmr: { server: createHttpServer() }, fs: { allow: [process.cwd(), folder] } }, optimizeDeps: { noDiscovery: true, include: [] }, cacheDir: mkdtempSync(resolve(tmpdir(), 'mdeck-vite-cache-')), appType: 'custom' })
const http = createHttpServer(vite.middlewares)
await new Promise(done => http.listen(0, '127.0.0.1', done))
const base = `http://127.0.0.1:${http.address().port}`
after(async () => { http.close(); await vite.close() })

test('without a deck, the design page gets the sample deck and saves only extensions', async () => {
  const deck = await (await fetch(`${base}/__mdeck/deck`)).json()
  assert.equal(deck.designOnly, true)
  assert.equal(deck.name, basename(folder))
  assert.equal(deck.source, source)
  const refused = await fetch(`${base}/__mdeck/source`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: 'x', base: deck.hash }) })
  assert.equal(refused.status, 403)
  const saved = await fetch(`${base}/__mdeck/extension/palette/mine`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: starterFiles('palette', 'mine', 'Mine') }) })
  assert.equal(saved.status, 200)
  assert.ok((await saved.json()).registry.palettes.some(palette => palette.id === 'mine' && palette.source === 'local'))
  assert.ok(existsSync(resolve(folder, 'extensions/mine/extension.toml')))
  const slides = await vite.transformRequest('virtual:slides')
  assert.ok(slides.code.includes('A talk about *trying* themes.'))
  assert.deepEqual(readdirSync(folder), ['extensions'])
  // Its references come from memory: formatted, with nothing written.
  const bibliography = await vite.transformRequest('virtual:bibliography')
  assert.match(bibliography.code, /\(Doe &#38; Roe, 2024, p\. 4\)/)
  assert.match(bibliography.code, /export const sample = \{/)
})
