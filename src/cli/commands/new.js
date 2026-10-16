// mdeck new: makes a deck from a few questions.
import { existsSync } from 'fs'
import { mkdir, writeFile } from 'fs/promises'
import { resolve, dirname, basename } from 'path'
import readline from 'readline/promises'
import { manifestsOf } from '../../extensions/discover.js'
import { c, ok, err, tip } from '../ui.js'

const ASPECT_RATIOS = [
  { label: '16:9 (widescreen)', w: 16, h: 9 },
  { label: '16:10 (widescreen)', w: 16, h: 10 },
  { label: '4:3 (classic)', w: 4, h: 3 },
]

function parseSelection(input, max) {
  const picks = [...new Set(
    String(input || '')
      .split(',')
      .map(v => parseInt(v.trim(), 10))
      .filter(n => Number.isInteger(n) && n >= 1 && n <= max)
  )]
  return picks
}

export default async function newDeck({ registryFor }) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  // Ctrl+D closes the questions: nothing is written.
  let closing = false
  rl.once('close', () => { if (!closing) { console.log(); tip('Stopped; no deck was made.'); process.exit(1) } })
  try {
    console.log()
    console.log(`  ${c.bold}Create a new deck${c.reset}`)
    const rawPath = (await rl.question('  Deck file path (default: slides.md): ')).trim() || 'slides.md'
    const outPath = resolve(process.cwd(), rawPath)
    if (existsSync(outPath)) {
      err(`File already exists: ${outPath}`)
      process.exit(1)
    }

    const registry = registryFor(outPath)
    const THEMES = Object.keys(registry.themes)
    const palettes = Object.keys(registry.palettes)
    const describe = record => `${record.id} — ${record.title}${record.description ? ` (${record.description})` : ''}`
    console.log('\n  Theme:')
    THEMES.forEach((name, i) => console.log(`    ${i + 1}) ${describe(registry.themes[name])}`))
    const tIdx = parseInt((await rl.question('  Pick a theme [1]: ')).trim() || '1', 10)
    const theme = THEMES[tIdx - 1] || THEMES[0]

    console.log('\n  Palette:')
    console.log('    0) none')
    palettes.forEach((name, i) => console.log(`    ${i + 1}) ${describe(registry.palettes[name])}`))
    const pRaw = (await rl.question('  Pick a palette [0]: ')).trim() || '0'
    const pIdx = parseInt(pRaw, 10)
    const palette = pIdx > 0 ? (palettes[pIdx - 1] || '') : ''

    const LAYOUT_LIBRARY = Object.values(manifestsOf(registry, 'layout')).map(manifest => ({ key: manifest.id, label: manifest.title, starter: manifest.starter }))
    console.log('\n  Slide layouts (comma-separated numbers):')
    LAYOUT_LIBRARY.forEach((opt, i) => console.log(`    ${i + 1}) ${opt.label}`))
    const defaultLayouts = '1,2,3,4'
    const picks = parseSelection((await rl.question(`  Pick layouts [${defaultLayouts}]: `)).trim() || defaultLayouts, LAYOUT_LIBRARY.length)
    const chosen = (picks.length ? picks : parseSelection(defaultLayouts, LAYOUT_LIBRARY.length))
      .map(i => LAYOUT_LIBRARY[i - 1])

    const title = (await rl.question('  Presentation title [My Talk]: ')).trim() || 'My Talk'
    const author = (await rl.question('  Author [Your Name]: ')).trim() || 'Your Name'
    const org = (await rl.question('  Organization [FHNW]: ')).trim() || 'FHNW'

    console.log('\n  Aspect ratio (uses 1920px width baseline):')
    ASPECT_RATIOS.forEach((opt, i) => console.log(`    ${i + 1}) ${opt.label}`))
    console.log(`    ${ASPECT_RATIOS.length + 1}) Custom`)
    const rIdx = parseInt((await rl.question('  Pick an aspect ratio [1]: ')).trim() || '1', 10)
    let width = 1920
    let ratioW = ASPECT_RATIOS[0].w
    let ratioH = ASPECT_RATIOS[0].h
    if (rIdx >= 1 && rIdx <= ASPECT_RATIOS.length) {
      ratioW = ASPECT_RATIOS[rIdx - 1].w
      ratioH = ASPECT_RATIOS[rIdx - 1].h
    } else if (rIdx === ASPECT_RATIOS.length + 1) {
      const rawW = parseInt((await rl.question('  Ratio width [16]: ')).trim() || '16', 10)
      const rawH = parseInt((await rl.question('  Ratio height [9]: ')).trim() || '9', 10)
      ratioW = Number.isInteger(rawW) && rawW > 0 ? rawW : ratioW
      ratioH = Number.isInteger(rawH) && rawH > 0 ? rawH : ratioH
    }
    const height = Math.round((width * ratioH) / ratioW)

    const lines = [
      '---',
      `theme: ${theme}`,
      ...(palette ? [`palette: ${palette}`] : []),
      'meta:',
      `  title: "${title.replace(/"/g, '\\"')}"`,
      `  author: "${author.replace(/"/g, '\\"')}"`,
      `  organization: "${org.replace(/"/g, '\\"')}"`,
      `  date: "${new Date().toISOString().slice(0, 10)}"`,
      '  # logo: ./img/logo.png',
      `width: ${width}`,
      `height: ${height}`,
      '---',
      '',
    ]

    chosen.forEach((opt, i) => {
      lines.push('---\n' + opt.starter)
      lines.push('')
    })

    await mkdir(dirname(outPath), { recursive: true })
    await writeFile(outPath, lines.join('\n'), 'utf-8')

    const assetDir = resolve(dirname(outPath), 'img')
    await mkdir(assetDir, { recursive: true })
    await writeFile(resolve(assetDir, '.gitkeep'), '', 'utf-8')

    console.log()
    ok(`Created ${c.cyan}${outPath}${c.reset}`)
    tip(`Added assets folder: ${assetDir}; put a logo there and take the # off the logo line`)
    tip(`Next: mdeck run ${basename(outPath)}\n`)
  } finally {
    closing = true
    rl.close()
  }
}
