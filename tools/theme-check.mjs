// Every built-in theme, light and dark, on the sample deck, and `mdeck check
// --render` on a deck with problems: `npm run test:themes` (needs Chrome; set
// MDECK_CHROME if it is not found). The check itself is
// src/build/themeCheck.js.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadRegistry, manifestsOf } from '../src/extensions/discover.js'
import { checkLooks } from '../src/build/themeCheck.js'
import { renderCheck, snapshot } from '../src/build/renderCheck.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const themes = Object.keys(manifestsOf(loadRegistry(resolve(root, 'nowhere/slides.md'), { userRoot: null }), 'theme'))
const failures = await checkLooks(themes.map(theme => ({ theme })))
if (failures.length) {
  console.error(`Theme check failed (${failures.length}):\n  ${failures.join('\n  ')}`)
  process.exit(1)
}

// A user's deck: one slide fine, one too full, one with pale text; the
// problems name the slide and the line its heading is on.
const temp = mkdtempSync(resolve(tmpdir(), 'mdeck-render-check-'))
try {
  const deck = resolve(temp, 'slides.md')
  writeFileSync(deck, `---\ntitle: Render\n---\n\n# Fine\n\nShort.\n\n---\n\n## Full\n\n${Array.from({ length: 24 }, (_, i) => `- item ${i + 1}`).join('\n')}\n\n---\n\n## Pale\n\n<span style="color:#ddd">Barely visible text</span>\n`)
  const found = (await renderCheck(deck)).map(d => `${d.line} ${d.message}`)
  assert.equal(found.length, 3, found.join('\n'))
  assert.match(found[0], /^11 slide 2 \(“Full”\): the content is \d+px taller than its place$/)
  assert.match(found[1], /^11 slide 2 \(“Full”\): "item \d+" and \d+ more lines are cut off at the edge$/)
  assert.match(found[2], /^40 slide 3 \(“Pale”\): "Barely visible text" has a contrast of 1\.\d:1$/)
  const files = await snapshot(deck, { slides: [3, 1], outDir: resolve(temp, 'shots') })
  assert.deepEqual(files.map(file => file.slice(temp.length + 1)), ['shots/slides-03.png', 'shots/slides-01.png'])
} finally { rmSync(temp, { recursive: true, force: true }) }
console.log(`Theme checks passed: ${themes.join(', ')}, light and dark, every built-in layout; and the render check of a deck.`)
