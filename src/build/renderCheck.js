// A deck as it shows, in a real browser: `mdeck check --render` finds slides
// whose content does not fit, text cut off at the slide's edge or hard to
// read on what is behind it, and errors the page reports; `mdeck snapshot`
// saves pictures of slides, so a person or an assistant can look at them.
// Both build the deck as it is (with the extensions installed here), show
// every slide with all its steps revealed, as in a PDF, and need Chrome
// (MDECK_CHROME). The measuring is the theme check's (themeCheck.js).
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, resolve } from 'node:path'
import { launchChrome } from './chrome.js'
import { frameworkRoot } from '../paths.js'
import { parseSlides } from '../core/parseSlides.js'
import { MEASURE, RECORDER, settle } from './themeCheck.js'

// Each slide's number, line and heading, for messages.
export function slideLabels(source) {
  return parseSlides(source).slides.map((slide, index) => {
    // The slide's first written line, past its settings and blank lines.
    const body = slide.bodySource ?? slide.source ?? { start: 0, end: 0 }
    let start = body.start
    while (/\s/.test(source[start] ?? '') && start < body.end) start++
    const line = source.slice(0, start).split('\n').length
    const heading = /^#{1,2}\s+(.+)$/m.exec(slide.content ?? '')?.[1]?.replace(/[*_`]/g, '').trim() ?? null
    return { number: index + 1, id: slide.id, line, heading }
  })
}

// Builds the deck into a temporary folder and opens it in Chrome for
// `use({ page, count })`, at `appearance` ('' for the deck's own), with every
// step revealed.
async function withDeckPage(slidesPath, { appearance = '', width = 1600, height = 900 } = {}, use) {
  const abs = resolve(slidesPath)
  const temp = mkdtempSync(resolve(tmpdir(), 'mdeck-render-'))
  try {
    try {
      execFileSync(process.execPath, [resolve(frameworkRoot, 'bin/mdeck.js'), 'build', abs, '-o', resolve(temp, 'out/index.html')], { cwd: dirname(abs), stdio: 'pipe' })
    } catch (error) {
      throw new Error(`The deck could not be built: ${String(error.stderr ?? error.message).replace(/\x1b\[[0-9;]*m/g, '').trim().split('\n').slice(-3).join(' ')}`)
    }
    const browser = await launchChrome({ dir: resolve(temp, 'out') })
    try {
      const page = await browser.open('about:blank')
      await page.send('Page.enable')
      await page.send('Page.addScriptToEvaluateOnNewDocument', { source: RECORDER })
      await page.send('Page.navigate', { url: `${browser.origin}/index.html?embedded=1${appearance ? `&appearance=${appearance}` : ''}#1` })
      await page.waitFor("location.href.includes('index.html')")
      await page.waitForDeck()
      await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
      await page.evaluate("document.querySelector('deck-stage').printing = true")
      const count = await page.evaluate("document.querySelector('deck-stage').length")
      return await use({ page, count, show: async index => { await page.evaluate(`window.__index = ${index}; document.querySelector('deck-stage').goTo(${index})`); await settle(page) } })
    } finally { await browser.close() }
  } finally { rmSync(temp, { recursive: true, force: true }) }
}

// The problems of each slide, in the deck's own look, as diagnostics
// ({ severity, code, message, line }) at the line the slide starts.
export function renderCheck(slidesPath) {
  const labels = slideLabels(readFileSync(slidesPath, 'utf8'))
  return withDeckPage(slidesPath, {}, async ({ page, count, show }) => {
    const diagnostics = []
    for (let index = 0; index < count; index++) {
      await show(index)
      const label = labels[index] ?? { number: index + 1, line: 1, heading: null }
      const where = `slide ${label.number}${label.heading ? ` (“${label.heading}”)` : ''}`
      // Content that does not fit cuts off line after line; the first says which.
      const problems = await page.evaluate(MEASURE)
      const cut = problems.filter(problem => problem.endsWith(' is cut off at the edge'))
      const shown = problems.filter(problem => !cut.includes(problem))
      if (cut.length) shown.push(cut.length === 1 ? cut[0] : `${cut[0].replace(/ is cut off at the edge$/, '')} and ${cut.length - 1} more ${cut.length === 2 ? 'line is' : 'lines are'} cut off at the edge`)
      for (const problem of shown) diagnostics.push({ severity: 'warning', code: 'render', message: `${where}: ${problem}`, line: label.line })
    }
    // The deck's own warning about content that does not fit is said above, per slide.
    for (const line of (await page.evaluate('window.__report')).filter(line => !/has more content than fits/.test(line))) diagnostics.push({ severity: line.startsWith('error') ? 'error' : 'warning', code: 'render', message: `the page reported ${line}`, line: 1 })
    return diagnostics
  })
}

// Pictures of slides (numbers from 1; all when none are given) as PNG files
// in `outDir`, named <deck>-<number>.png. Returns the files written.
export async function snapshot(slidesPath, { slides = [], outDir, width = 1280, height = 720, appearance = '' } = {}) {
  const name = basename(slidesPath).replace(/\.md$/i, '')
  mkdirSync(outDir, { recursive: true })
  return withDeckPage(slidesPath, { appearance, width, height }, async ({ page, count, show }) => {
    const wanted = slides.length ? slides : Array.from({ length: count }, (_, i) => i + 1)
    const files = []
    for (const number of wanted) {
      if (number < 1 || number > count) throw new Error(`There is no slide ${number}; the deck has ${count}`)
      await show(number - 1)
      const file = resolve(outDir, `${name}-${String(number).padStart(2, '0')}.png`)
      writeFileSync(file, await page.screenshot({ width, height }))
      files.push(file)
    }
    return files
  })
}
