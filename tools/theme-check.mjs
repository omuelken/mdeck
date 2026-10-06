// Every theme, light and dark, on a deck that uses every built-in layout and
// kind of content. Fails when a slide's content does not fit, text is cut off
// at the slide's edge, text is hard to read on what is behind it, or the page
// reports an error. Run with `npm run test:themes` (needs Chrome; set
// MDECK_CHROME if it is not found).
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launchChrome } from '../src/build/chrome.js'
import { loadRegistry, manifestsOf } from '../src/extensions/discover.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const temp = mkdtempSync(resolve(tmpdir(), 'mdeck-theme-check-'))

// Ordinary amounts of content: what a theme must hold without cutting off.
const DECK = `---
meta:
  title: "Theme check"
  author: "A. Author"
  organization: "Institute"
  date: "2026-10-06"
---

---
layout: title
---
# A talk about *checking* themes.
## Every layout and every kind of content, once.

---
layout: title
image: ./picture.svg
alt: "Shapes"
---
# A title with a picture.
## And a subtitle beside it.

---
layout: chapter
number: 2
part: Methods
---
# How it was *measured*

One sentence about what this chapter covers.

---
layout: chapter
number: 3
image: ./picture.svg
alt: "Shapes"
---
# A chapter with a picture

---
# Lists, emphasis and code

- A point with *emphasis* and **strong** words
- A second point with \`inline code\`
  - A nested point
  - Another nested point

\`\`\`js
const total = values.reduce((sum, value) => sum + value, 0)
\`\`\`

---
# Numbers in a table

| Group | Mean | Spread |
|---|---|---|
| Control | 4.2 | 0.8 |
| Treatment | 5.1 | 0.6 |
| Follow-up | 5.0 | 0.7 |

The difference is $\\Delta = 0.9$, with a footnote.[^1]

[^1]: A source for the claim.

---
# Callouts

::: tip
A tip in one sentence.
:::

::: warning
A warning in one sentence.
:::

::: note Your own title
A note with a title of its own.
:::

---
# Blocks for lectures

::: definition Definition 1 (Group)
A set with an associative operation, a neutral element and inverses.
:::

::: theorem Theorem 2 (Lagrange)
The order of a subgroup divides the order of the group.
:::

::: proof
The cosets partition the group into parts of equal size.
:::

---
# Two columns

:::columns
Some text on the left, with a formula:

$$
\\int_0^1 x^2 \\, dx = \\frac{1}{3}
$$

+++

1. First step
2. Second step
3. Third step
:::

---
layout: focus
eyebrow: Key point
attribution: "Someone wise"
---
# A statement that takes a line or two on the slide.

---
layout: image-text
image: ./picture.svg
alt: "Shapes"
---
# A picture beside words

Two sentences of text beside the picture. They explain what it shows.

---
layout: split
---
# A split slide
:::slot left
\`\`\`python
def mean(values):
    return sum(values) / len(values)
\`\`\`
:::
:::slot right
- What the code does
- Why it matters
:::

---
layout: full-bleed-image
image: ./picture.svg
alt: "Shapes"
overlay: true
---
# A picture that fills the slide.
`

const PICTURE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#6b7f99"/><circle cx="140" cy="150" r="80" fill="#e0c068"/><rect x="220" y="80" width="120" height="140" fill="#2d3e50"/></svg>'

// Runs in the page before the deck: keeps what the page reports.
const RECORDER = `window.__report = [];
for (const level of ['warn', 'error']) { const original = console[level]; console[level] = (...args) => { window.__report.push(level + ': ' + args.map(String).join(' ')); original.apply(console, args) } }
addEventListener('error', event => window.__report.push('error: ' + event.message))
addEventListener('unhandledrejection', event => window.__report.push('error: ' + (event.reason?.message ?? event.reason)))`

// Runs in the page for the slide on screen: what is cut off or hard to read.
const MEASURE = `(() => {
  const slide = document.querySelector('deck-stage').querySelectorAll(':scope > section')[window.__index]
  const problems = []
  const frame = slide.getBoundingClientRect()
  const scale = frame.width / slide.offsetWidth
  const body = slide.querySelector('.slide-body')
  if (body && body.scrollHeight > body.clientHeight + 2) problems.push('the content is ' + Math.round(body.scrollHeight - body.clientHeight) + 'px taller than its place')
  const parse = value => { const m = value.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r, g, b, a } }
  const lum = ({ r, g, b }) => { const c = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b) }
  const ratio = (x, y) => { const [a, b] = [lum(x), lum(y)].sort((p, q) => q - p); return (a + 0.05) / (b + 0.05) }
  // The colour behind an element, when it is a plain colour; null behind a
  // picture or a gradient, where it cannot be told.
  // The slide's own ::before and ::after fields (duet's chapter colour field),
  // as rectangles in slide coordinates.
  const fields = ['::before', '::after'].map(pseudo => getComputedStyle(slide, pseudo)).filter(drawn => drawn.content !== 'none' && drawn.position === 'absolute'
    && (drawn.backgroundImage !== 'none' || (parse(drawn.backgroundColor)?.a ?? 0) > 0.05))
    .map(drawn => { const left = parseFloat(drawn.left) || 0, top = parseFloat(drawn.top) || 0; return { left, top, right: left + (parseFloat(drawn.width) || slide.offsetWidth), bottom: top + (parseFloat(drawn.height) || slide.offsetHeight) } })
  const behind = (element, box) => {
    if (element.closest('.slide--full-bleed-image')) return null
    const x = (box.left + box.width / 2 - frame.left) / scale, y = (box.top + box.height / 2 - frame.top) / scale
    if (fields.some(field => x >= field.left && x <= field.right && y >= field.top && y <= field.bottom)) return null
    for (let node = element; node && node !== document.documentElement; node = node.parentElement) {
      const style = getComputedStyle(node)
      // A field drawn by ::before or ::after (duet's chapter) is behind it too.
      for (const pseudo of ['::before', '::after']) {
        const drawn = getComputedStyle(node, pseudo)
        const painted = drawn.backgroundImage !== 'none' || (parse(drawn.backgroundColor)?.a ?? 0) > 0.05
        const area = (parseFloat(drawn.width) || 0) * (parseFloat(drawn.height) || 0)
        if (node !== slide && drawn.content !== 'none' && painted && area >= 0.25 * node.offsetWidth * node.offsetHeight) return null
      }
      if (style.backgroundImage !== 'none' && !(node === slide && /radial-gradient/.test(style.backgroundImage) && !/linear/.test(style.backgroundImage))) return null
      const colour = parse(style.backgroundColor)
      if (colour && colour.a >= 0.95) return colour
      if (colour && colour.a > 0.05) return null
      if (node === slide) return colour
    }
    return null
  }
  const walker = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT)
  const seen = new Set()
  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    const element = text.parentElement
    if (!text.textContent.trim() || seen.has(element) || element.closest('.slide-ink, .katex-mathml, [aria-hidden="true"], .slide--full-bleed-image .slide-bg')) continue
    seen.add(element)
    const style = getComputedStyle(element)
    if (style.visibility === 'hidden' || Number(style.opacity) === 0 || element.closest('[data-step]:not([data-step-visible])')) continue
    const range = document.createRange()
    range.selectNodeContents(text)
    const box = range.getBoundingClientRect()
    if (!box.width || !box.height) continue
    const words = text.textContent.trim().slice(0, 40)
    if (box.left < frame.left - 2 * scale || box.right > frame.right + 2 * scale || box.top < frame.top - 2 * scale || box.bottom > frame.bottom + 2 * scale) problems.push('"' + words + '" is cut off at the edge')
    const colour = parse(style.color), back = behind(element, box)
    if (!colour || !back || colour.a < 0.5 || element.closest('.code-block, .katex')) continue
    const large = parseFloat(style.fontSize) / scale >= 40 || (parseFloat(style.fontSize) / scale >= 30 && Number(style.fontWeight) >= 600)
    const value = ratio(colour, back)
    if (value < (large ? 2.6 : 3.4)) problems.push('"' + words + '" has a contrast of ' + value.toFixed(1) + ':1')
  }
  return problems
})()`

const registry = loadRegistry(resolve(temp, 'slides.md'))
const themes = Object.keys(manifestsOf(registry, 'theme'))
const failures = []
try {
  writeFileSync(resolve(temp, 'slides.md'), DECK)
  writeFileSync(resolve(temp, 'picture.svg'), PICTURE)
  execFileSync(process.execPath, [resolve(root, 'bin/mdeck.js'), 'build', resolve(temp, 'slides.md'), '-o', resolve(temp, 'out/index.html')], { cwd: temp, stdio: 'pipe' })
  const browser = await launchChrome({ dir: resolve(temp, 'out') })
  try {
    for (const theme of themes) {
      for (const appearance of ['light', 'dark']) {
        const page = await browser.open('about:blank')
        await page.send('Page.enable')
        await page.send('Page.addScriptToEvaluateOnNewDocument', { source: RECORDER })
        await page.send('Page.navigate', { url: `${browser.origin}/index.html?embedded=1&theme=${theme}&palette=&appearance=${appearance}#1` })
        await page.waitFor("location.href.includes('index.html')")
        await page.waitForDeck()
        await page.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false })
        const count = await page.evaluate("document.querySelector('deck-stage').length")
        for (let index = 0; index < count; index++) {
          await page.evaluate(`window.__index = ${index}; document.querySelector('deck-stage').goTo(${index})`)
          // Two frames: the stage shows the slide, then fit.js measures it.
          await page.evaluate('new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 60))))')
          for (const problem of await page.evaluate(MEASURE)) failures.push(`${theme} (${appearance}), slide ${index + 1}: ${problem}`)
        }
        for (const line of await page.evaluate('window.__report')) failures.push(`${theme} (${appearance}): ${line}`)
        await page.close()
      }
    }
  } finally { await browser.close() }
} finally { rmSync(temp, { recursive: true, force: true }) }

if (failures.length) {
  console.error(`Theme check failed (${failures.length}):\n  ${failures.join('\n  ')}`)
  process.exit(1)
}
console.log(`Theme checks passed: ${themes.join(', ')}, light and dark, every built-in layout.`)
