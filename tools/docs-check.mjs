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
  assert.ok(await page.waitFor("!!document.querySelector('[data-preview] select')"))
  const theme = parseSlides(readFileSync('examples/custom-layouts/slides.md', 'utf8')).deckConfig.theme
  assert.equal(await page.evaluate("document.querySelector('[data-preview] select').value"), theme, 'picker starts on the deck theme')
  await page.evaluate("document.querySelector('[data-preview] iframe').scrollIntoView()")
  assert.ok(await page.waitFor("!!document.querySelector('[data-preview] iframe')?.contentDocument?.getElementById('deck-theme')"))
  const before = await page.evaluate("document.querySelector('[data-preview] iframe').contentDocument.getElementById('deck-theme').textContent")
  await page.evaluate("const select = document.querySelector('[data-preview] select'); select.value = 'terminal'; select.dispatchEvent(new Event('change'))")
  // Terminal starts dark with its default palette, forest.
  assert.ok(await page.waitFor("document.querySelector('[data-preview] iframe')?.contentDocument?.getElementById('deck-palette')?.textContent?.includes('#0e1a14')"))
  const after = await page.evaluate("document.querySelector('[data-preview] iframe').contentDocument.getElementById('deck-theme').textContent")
  assert.notEqual(after, before, 'picker actually changes the iframe theme')
  const address = new URL(await page.evaluate("document.querySelector('[data-preview] iframe').src"))
  assert.equal(address.searchParams.get('theme'), 'terminal')
  assert.equal(address.searchParams.has('design'), false)
  console.log('Documentation checks passed: site builds, initial theme matches the deck, picker changes the preview.')
} finally { await browser?.close(); rmSync(dir, { recursive: true, force: true }) }
