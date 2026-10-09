import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { buildDocs } from '../docs/site/build.js'
import { launchChrome } from '../src/build/chrome.js'
import { parseSlides } from '../src/core/parseSlides.js'

const dir = mkdtempSync(resolve(tmpdir(), 'mdeck-docs-check-'))
let browser
try {
  await buildDocs({ outDir: dir })
  browser = await launchChrome({ dir, timeout: 45000 })
  const page = await browser.open('reusable-layouts.html')
  assert.ok(await page.waitFor("!!document.querySelector('[data-preview] [data-theme]')"))
  const theme = parseSlides(readFileSync('examples/custom-layouts/slides.md', 'utf8')).deckConfig.theme
  assert.equal(await page.evaluate("document.querySelector('[data-preview] [data-theme][aria-checked=true]').dataset.theme"), theme, 'picker starts on the deck theme')
  assert.ok(await page.evaluate("document.querySelectorAll('[data-preview] [data-theme] img').length >= 6"), 'every built-in theme shows as a picture')
  await page.evaluate("document.querySelector('[data-preview] iframe').scrollIntoView()")
  assert.ok(await page.waitFor("!!document.querySelector('[data-preview] iframe')?.contentDocument?.getElementById('deck-theme')"))
  const before = await page.evaluate("document.querySelector('[data-preview] iframe').contentDocument.getElementById('deck-theme').textContent")
  await page.evaluate("document.querySelector('[data-preview] [data-theme=academic]').click()")
  // Academic starts light with its default palette, nordic.
  assert.ok(await page.waitFor("document.querySelector('[data-preview] iframe')?.contentDocument?.getElementById('deck-palette')?.textContent?.includes('#1f6f9f')"))
  const after = await page.evaluate("document.querySelector('[data-preview] iframe').contentDocument.getElementById('deck-theme').textContent")
  assert.notEqual(after, before, 'picker actually changes the iframe theme')
  const address = new URL(await page.evaluate("document.querySelector('[data-preview] iframe').src"))
  assert.equal(address.searchParams.get('theme'), 'academic')
  assert.equal(address.searchParams.has('design'), false)
  // Light or dark, on the same theme.
  await page.evaluate("document.querySelector('[data-preview] [data-set-appearance=dark]').click()")
  const dark = new URL(await page.evaluate("document.querySelector('[data-preview] iframe').src"))
  assert.deepEqual([dark.searchParams.get('theme'), dark.searchParams.get('appearance')], ['academic', 'dark'])
  assert.equal(await page.evaluate("document.querySelector('[data-preview] [data-set-appearance=dark]').getAttribute('aria-checked')"), 'true')
  console.log('Documentation checks passed: site builds, initial theme matches the deck, theme pictures and light or dark change the preview.')
} finally { await browser?.close(); rmSync(dir, { recursive: true, force: true }) }
