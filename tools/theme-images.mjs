// Renders the theme pictures in the "Change the look" guide from the tour:
// docs/site/images/themes/<theme>.webp, its title slide in the theme's default
// look, and <theme>-light.webp and <theme>-dark.webp, contact sheets of its
// first chapter slide in every palette the theme offers. Themes with a single
// palette get no contact sheets.
// Needs a local Chrome and ImageMagick (`magick`).
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launchChrome } from '../src/build/chrome.js'
import { loadRegistry, manifestsOf } from '../src/extensions/discover.js'
import { palettesFor } from '../src/extensions/tokens.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(root, 'docs/site/images/themes')
const deck = resolve(root, 'examples/showcase/slides.md')
const font = ['/System/Library/Fonts/Helvetica.ttc', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'].find(existsSync)
const temp = mkdtempSync(resolve(tmpdir(), 'mdeck-themes-'))
mkdirSync(out, { recursive: true })
const registry = loadRegistry(deck)
const themes = manifestsOf(registry, 'theme')
const palettes = manifestsOf(registry, 'palette')
try {
  // A folder, not --single-file, so the pictures show the themes' own fonts.
  execFileSync(process.execPath, [resolve(root, 'bin/mdeck.js'), 'build', deck, '-o', resolve(temp, 'deck.html')], { cwd: root, stdio: 'pipe' })
  const browser = await launchChrome({ dir: temp })
  try {
    const shot = async (query, file, size, slide = 1) => {
      const page = await browser.open(`deck.html?embedded=1&${query}#${slide}`)
      await page.waitForDeck()
      writeFileSync(file, await page.screenshot(size))
      await page.close()
    }
    for (const theme of Object.values(themes)) {
      const preview = resolve(temp, `${theme.id}.png`)
      await shot(`theme=${theme.id}&palette=&appearance=`, preview, { width: 1600, height: 900 })
      execFileSync('magick', [preview, '-quality', '82', resolve(out, `${theme.id}.webp`)])
      console.log('wrote', `${theme.id}.webp`)
      const offered = palettesFor(theme, palettes)
      if (offered.length < 2) continue
      for (const appearance of ['light', 'dark']) {
        const tiles = []
        for (const palette of offered) {
          const file = resolve(temp, `${theme.id}-${palette.id}-${appearance}.png`)
          // The first chapter slide: the theme's showpiece, in the palette's colours.
          await shot(`theme=${theme.id}&palette=${palette.id}&appearance=${appearance}`, file, { width: 1280, height: 720 }, 2)
          tiles.push({ file, label: palette.id })
        }
        // Two tiles a row, so each is large in the guide's tab.
        const sheet = resolve(temp, `${theme.id}-${appearance}-sheet.png`)
        execFileSync('magick', ['montage', ...tiles.flatMap(t => ['-label', t.label, t.file]),
          ...(font ? ['-font', font] : []), '-pointsize', '26', '-fill', '#333333', '-background', '#ffffff',
          '-bordercolor', '#cccccc', '-border', '1', '-geometry', '800x450+16+14', '-tile', '2x', sheet])
        execFileSync('magick', [sheet, '-quality', '80', resolve(out, `${theme.id}-${appearance}.webp`)])
        console.log('wrote', `${theme.id}-${appearance}.webp`)
      }
    }
  } finally { await browser.close() }
} finally { rmSync(temp, { recursive: true, force: true }) }
