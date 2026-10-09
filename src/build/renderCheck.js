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
// in `outDir`, named <deck>-<number>.png. With `sheet`, one picture instead,
// <deck>-sheet.png: the slides in a grid, each under its number and heading,
// so a person or an assistant sees the whole deck at once. Returns the files
// written.
export async function snapshot(slidesPath, { slides = [], outDir, width = 1280, height = 720, appearance = '', sheet = false } = {}) {
  const name = basename(slidesPath).replace(/\.md$/i, '')
  const labels = sheet ? slideLabels(readFileSync(slidesPath, 'utf8')) : []
  mkdirSync(outDir, { recursive: true })
  return withDeckPage(slidesPath, { appearance, width, height }, async ({ page, count, show }) => {
    const wanted = slides.length ? slides : Array.from({ length: count }, (_, i) => i + 1)
    const files = [], shots = []
    for (const number of wanted) {
      if (number < 1 || number > count) throw new Error(`There is no slide ${number}; the deck has ${count}`)
      await show(number - 1)
      const picture = await page.screenshot({ width, height })
      if (sheet) { shots.push({ number, heading: labels[number - 1]?.heading ?? '', picture }); continue }
      const file = resolve(outDir, `${name}-${String(number).padStart(2, '0')}.png`)
      writeFileSync(file, picture)
      files.push(file)
    }
    if (!sheet) return files
    const file = resolve(outDir, `${name}-sheet.png`)
    writeFileSync(file, await contactSheet(page, shots))
    return [file]
  })
}

// The slides' pictures in a grid on a dark page, each at half size under its
// number and heading; drawn by the page that took them, as its last task.
const CELL = { width: 640, height: 360, label: 30, gap: 24 }
async function contactSheet(page, shots) {
  const columns = shots.length <= 1 ? 1 : shots.length <= 4 ? 2 : shots.length <= 9 ? 3 : 4
  const rows = Math.ceil(shots.length / columns)
  const width = columns * CELL.width + (columns + 1) * CELL.gap
  const height = rows * (CELL.height + CELL.label) + (rows + 1) * CELL.gap
  const escape = text => String(text).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch])
  const cells = shots.map(({ number, heading, picture }) => `<figure><figcaption><b>${String(number).padStart(2, '0')}</b> ${escape(heading)}</figcaption><img src="data:image/png;base64,${picture.toString('base64')}"></figure>`).join('')
  const html = `<!doctype html><meta charset="utf-8"><style>
    html, body { margin: 0; background: #1c1c1c; }
    main { display: grid; grid-template-columns: repeat(${columns}, ${CELL.width}px); gap: ${CELL.gap}px; padding: ${CELL.gap}px; }
    figure { margin: 0; }
    figcaption { height: ${CELL.label}px; font: 15px/1.2 system-ui, sans-serif; color: #c8c8c8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    figcaption b { color: #fff; margin-right: 6px; font-variant-numeric: tabular-nums; }
    img { display: block; width: ${CELL.width}px; height: ${CELL.height}px; outline: 1px solid #3a3a3a; }
  </style><main>${cells}</main>`
  await page.evaluate(`document.open(); document.write(${JSON.stringify(html)}); document.close(); Promise.all([...document.images].map(image => image.decode())).then(() => true)`)
  return page.screenshot({ width, height })
}
