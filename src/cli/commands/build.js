// mdeck build and mdeck send: a folder to host, or one file to send.
import { build } from 'vite'
import { existsSync, copyFileSync, mkdtempSync, readFileSync, statSync } from 'fs'
import { rm, mkdir } from 'fs/promises'
import { resolve, dirname, basename, relative, isAbsolute } from 'path'
import { tmpdir } from 'os'
import preact from '@preact/preset-vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { collectLocalAssetRefs, slidesPlugin } from '../../build/slidesPlugin.js'
import { expandedSource } from '../../build/include.js'
import { renderPdf, attachPdf } from '../../build/pdf.js'
import { stripNotes as stripNotesFrom, shareSlides } from '../../core/editDeck.js'
import { assertDrawings } from '../../build/drawings.js'
import { baseConfig } from '../../build/config.js'
import { c, ok, err, tip } from '../ui.js'
import { writePresenterLaunchers } from '../launchers.js'

async function copyLocalAssets(slidesPath, outDir, { stripNotes = false, stripActivities = false, slides = null } = {}) {
  const absSlides = resolve(slidesPath)
  const deckDir = dirname(absSlides)
  const absOutDir = resolve(outDir)
  // The deck as shown: pictures of included slides are copied too.
  const raw = expandedSource(absSlides)
  let markdown = stripNotes ? stripNotesFrom(raw) : raw
  if (stripActivities || slides) markdown = shareSlides(markdown, { activities: stripActivities, slides }).source

  for (const ref of collectLocalAssetRefs(markdown)) {
    const source = resolve(deckDir, ref)
    const destination = resolve(absOutDir, ref)
    const outputRelativePath = relative(absOutDir, destination)

    // Preserve deck-relative paths, but never let a reference write outside
    // the selected build directory.
    if (outputRelativePath.startsWith('..') || isAbsolute(outputRelativePath)) continue
    if (!existsSync(source)) continue

    await mkdir(dirname(destination), { recursive: true })
    copyFileSync(source, destination)
  }
}

export default async function buildDeck({ command, options, hasFlag, outputOption, slideOption, requireInput }) {
  const input = requireInput(command)
  const sending = command === 'send'
  // build: a folder to host, or one file with --single-file. send: one file for
  // readers, in the reader view, without speaker notes unless asked, with a PDF.
  const selfContained = sending || hasFlag('--single-file')
  const launchers = !sending && hasFlag('--launchers')
  const reader = sending || hasFlag('--reader')
  const stripNotes = reader && !hasFlag('--notes')
  // Polls show as a record of the talk; --no-polls leaves their slides and join codes out.
  const stripActivities = reader && hasFlag('--no-polls')
  const wantPdf = sending && !hasFlag('--no-pdf')
  const slides = slideOption(input)

  if (!hasFlag('--no-drawings')) { try { assertDrawings(input) } catch (error) { err(error.message); process.exit(1) } }
  const given = outputOption()
  const defaultName = sending ? basename(input).replace(/\.md$/i, '') + '.html' : 'index.html'
  // -o names the file; a folder (dist/, or one that exists) takes the file under its usual name.
  const folderGiven = given && (/[\/\\]$/.test(given) || (existsSync(given) && statSync(given).isDirectory()))
  const outputPath = given ? resolve(process.cwd(), given, folderGiven ? defaultName : '') : sending ? resolve(process.cwd(), defaultName) : null

  const tempDir = outputPath ? mkdtempSync(resolve(tmpdir(), 'mdeck-')) : null
  const outDir = tempDir ?? resolve(process.cwd(), 'dist')
  const finalOutDir = outputPath ? dirname(outputPath) : outDir
  const htmlFilename = outputPath ? basename(outputPath) : 'index.html'

  try {
    await build({
      ...baseConfig(input, { selfContained, defaultView: reader ? 'reader' : 'deck' }),
      plugins: [preact(), slidesPlugin(resolve(input), { inlineImages: selfContained, inlineMedia: selfContained, embedFonts: selfContained, stripNotes, stripActivities, slides, ink: !hasFlag('--no-drawings'), results: !hasFlag('--no-results'), deckLook: reader }), viteSingleFile()],
      build: {
        outDir,
        emptyOutDir: !tempDir,
        target: 'esnext',
        assetsInlineLimit: 100 * 1024 * 1024,
      },
    })
  } catch (error) {
    if (tempDir) await rm(tempDir, { recursive: true, force: true })
    // The deck's own problems arrive as one error whose text lists them.
    err((error.errors?.[0]?.message ?? error.message).replace(/^\[[^\]]+\]\s*/, '').replace(/^Error: /, ''))
    process.exit(1)
  }

  await mkdir(finalOutDir, { recursive: true })

  if (!selfContained) {
    await copyLocalAssets(input, finalOutDir, { stripNotes, stripActivities, slides })
    if (launchers) await writePresenterLaunchers(finalOutDir, htmlFilename)
  }

  let htmlFile = resolve(outDir, 'index.html')
  if (outputPath && tempDir) {
    copyFileSync(resolve(tempDir, 'index.html'), outputPath)
    await rm(tempDir, { recursive: true })
    htmlFile = outputPath
  }
  if (wantPdf) {
    const pdfDir = mkdtempSync(resolve(tmpdir(), 'mdeck-send-pdf-'))
    const pdfFile = resolve(pdfDir, 'slides.pdf')
    try {
      await renderPdf({ htmlFile, output: pdfFile })
      attachPdf(htmlFile, pdfFile, { embed: true })
      await rm(pdfFile)
      ok(`PDF: ${c.cyan}embedded in ${htmlFile}${c.reset}`)
    } catch (error) {
      console.warn(`  ${c.yellow}!${c.reset}  PDF not rendered: ${error.message}`)
      tip('The reader view will offer the browser\'s "Save as PDF" dialog instead.')
    } finally { await rm(pdfDir, { recursive: true, force: true }) }
  }
  if (stripNotes) tip('Speaker notes were removed from this file (use --notes to keep them).')
  // Only polls among the slides chosen with --slide were left out for --no-polls.
  if (stripActivities) {
    const raw = readFileSync(resolve(input), 'utf-8')
    if (shareSlides(raw, { activities: true, slides }).removed.length > (slides ? shareSlides(raw, { slides }).removed.length : 0)) tip('Slides with polls were left out (--no-polls).')
  }
  if (slides) tip(`Only slides ${options['--slide']} (--slide).`)
  ok(`${sending ? 'Made' : 'Built'}: ${c.cyan}${htmlFile}${c.reset}${reader ? ' — opens in the reader view' : ''}${selfContained ? ' (single file)' : ' + local assets'}\n`)
}
