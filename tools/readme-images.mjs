// Renders the images used in README.md from the showcase deck:
// docs/images/hero.png, one slide per theme, a montage and a cycling GIF.
// Needs a local Chrome and ImageMagick (`magick`).
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launchChrome } from '../src/build/chrome.js'
import { loadRegistry } from '../src/extensions/discover.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(root, 'docs/images')
const deck = resolve(root, 'examples/showcase/slides.md')
const temp = mkdtempSync(resolve(tmpdir(), 'mdeck-readme-'))
mkdirSync(out, { recursive: true })
try {
  execFileSync(process.execPath, [resolve(root, 'bin/mdeck.js'), 'build', deck, '--single-file', '-o', resolve(temp, 'deck.html')], { cwd: root, stdio: 'pipe' })
  const browser = await launchChrome({ dir: temp })
  try {
    const shot = async (query, file, size) => {
      const page = await browser.open(`deck.html?embedded=1&${query}`)
      await page.waitForDeck()
      writeFileSync(file, await page.screenshot(size))
      await page.close()
      console.log('wrote', file)
    }
    await shot('design=neue&palette=&accent=&accent2=#1', resolve(out, 'hero.png'), { width: 1600, height: 900 })
    const themes = Object.keys(loadRegistry(deck).themes)
    const frames = themes.map(theme => resolve(temp, `theme-${theme}.png`))
    for (const [i, theme] of themes.entries()) await shot(`design=${theme}&palette=&accent=&accent2=#1`, frames[i], { width: 1280, height: 720 })
    const row = list => ['(', ...list.flatMap(file => ['(', file, '-resize', '640x360', '-bordercolor', '#111111', '-border', '6', ')']), '+append', ')']
    execFileSync('magick', [...row(frames.slice(0, 3)), ...row(frames.slice(3)), '-append', '-background', '#111111', resolve(out, 'themes.png')])
    execFileSync('magick', ['-delay', '140', '-loop', '0', ...frames, '-resize', '960x540', '-layers', 'optimize', resolve(out, 'themes.gif')])
    console.log('wrote themes.png and themes.gif')
  } finally { await browser.close() }
} finally { rmSync(temp, { recursive: true, force: true }) }
