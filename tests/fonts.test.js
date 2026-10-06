import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { embedFonts, latinFaces } from '../src/build/fonts.js'

// What Google Fonts answers: one block per character set and weight; a
// variable font repeats the same file for every weight.
const CSS = `/* cyrillic */
@font-face { font-family: 'Inter'; font-style: normal; font-weight: 400; src: url(https://fonts.test/inter-cyrillic.woff2) format('woff2'); unicode-range: U+0400-045F; }
/* latin */
@font-face { font-family: 'Inter'; font-style: normal; font-weight: 400; src: url(https://fonts.test/inter-latin.woff2) format('woff2'); unicode-range: U+0000-00FF; }
/* latin */
@font-face { font-family: 'Inter'; font-style: normal; font-weight: 700; src: url(https://fonts.test/inter-latin.woff2) format('woff2'); unicode-range: U+0000-00FF; }
`

function fakeFetch(log) {
  return async url => {
    log.push(url)
    if (url.endsWith('.css')) return { ok: true, text: async () => CSS }
    return { ok: true, arrayBuffer: async () => new TextEncoder().encode('FONT:' + url).buffer }
  }
}

test('only the Latin character sets are kept, and a variable font becomes one face with a weight range', () => {
  const faces = latinFaces(CSS)
  assert.equal(faces.length, 1)
  assert.match(faces[0], /font-weight: 400 700;/)
  assert.doesNotMatch(faces.join(''), /cyrillic/)
})

test('font files are embedded as data URIs, and a second build needs no network', async () => {
  const cacheDir = mkdtempSync(resolve(tmpdir(), 'mdeck-fonts-'))
  const log = []
  const first = await embedFonts(['https://fonts.test/inter.css'], { fetch: fakeFetch(log), cacheDir })
  assert.deepEqual(first.warnings, [])
  assert.match(first.css, /url\(data:font\/woff2;base64,/)
  assert.doesNotMatch(first.css, /fonts\.test\/inter-latin/)
  assert.deepEqual(log, ['https://fonts.test/inter.css', 'https://fonts.test/inter-latin.woff2'], 'the shared file is fetched once, Cyrillic not at all')
  const again = await embedFonts(['https://fonts.test/inter.css'], { fetch: () => { throw new Error('offline') }, cacheDir })
  assert.equal(again.css, first.css, 'from the cache')
})

test('without network and cache the build goes on with a warning', async () => {
  const cacheDir = mkdtempSync(resolve(tmpdir(), 'mdeck-fonts-'))
  const result = await embedFonts(['https://fonts.test/inter.css'], { fetch: async () => { throw Object.assign(new Error('fetch failed'), { cause: { code: 'ENOTFOUND' } }) }, cacheDir })
  assert.equal(result.css, '')
  assert.match(result.warnings[0], /could not be embedded \(ENOTFOUND\); the file uses the fallback fonts/)
})
