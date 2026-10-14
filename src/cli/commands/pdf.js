// mdeck pdf: a PDF, one page per slide.
import { build } from 'vite'
import { mkdtempSync } from 'fs'
import { rm, mkdir } from 'fs/promises'
import { resolve, dirname, basename } from 'path'
import { tmpdir } from 'os'
import preact from '@preact/preset-vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { slidesPlugin } from '../../build/slidesPlugin.js'
import { renderPdf, findChrome } from '../../build/pdf.js'
import { assertDrawings } from '../../build/drawings.js'
import { baseConfig } from '../../build/config.js'
import { c, ok, err } from '../ui.js'

export default async function pdf({ hasFlag, outputOption, slideOption, requireInput }) {
  const input = requireInput('pdf')
  const pdfFile = resolve(process.cwd(), outputOption() ?? basename(input).replace(/\.md$/i, '') + '.pdf')
  if (!hasFlag('--no-drawings')) { try { assertDrawings(input) } catch (error) { err(error.message); process.exit(1) } }
  if (!findChrome()) { err('No Chrome or Chromium found. Set MDECK_CHROME to its executable path.'); process.exit(1) }
  const slides = slideOption(input)
  const tempDir = mkdtempSync(resolve(tmpdir(), 'mdeck-pdf-'))
  try {
    await build({
      ...baseConfig(input, { selfContained: true }),
      plugins: [preact(), slidesPlugin(resolve(input), { inlineImages: true, inlineMedia: true, embedFonts: true, stripActivities: hasFlag('--no-polls'), slides, ink: !hasFlag('--no-drawings'), results: !hasFlag('--no-results'), deckLook: true }), viteSingleFile()],
      build: { outDir: tempDir, emptyOutDir: true, target: 'esnext', assetsInlineLimit: 100 * 1024 * 1024 },
      logLevel: 'warn',
    })
    await mkdir(dirname(pdfFile), { recursive: true })
    await renderPdf({ htmlFile: resolve(tempDir, 'index.html'), output: pdfFile })
    ok(`PDF: ${c.cyan}${pdfFile}${c.reset}\n`)
  } catch (error) { err(error.message); process.exitCode = 1 } finally { await rm(tempDir, { recursive: true, force: true }) }
}
