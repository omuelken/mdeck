// Deck validation shared by `mdeck check` and the launch page: source
// diagnostics plus local files the deck refers to but that are missing.
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { parseSlides } from '../core/parseSlides.js'
import { validateDeck } from '../core/validateDeck.js'
import { manifestsOf } from '../extensions/discover.js'
import { collectLocalAssetRefs } from './slidesPlugin.js'
import { componentFolders, isFolder } from './components.js'
import { inkFileFor, oldInkFileFor, validateInk, normalizeInk, orphanIds } from '../core/ink.js'

export function checkDeck(slidesPath, registry, source = readFileSync(slidesPath, 'utf8')) {
  const deck = parseSlides(source)
  const diagnostics = validateDeck(deck, { layouts: manifestsOf(registry, 'layout'), themes: manifestsOf(registry, 'theme'), palettes: manifestsOf(registry, 'palette') })
  for (const ref of collectLocalAssetRefs(source)) {
    if (!existsSync(resolve(dirname(resolve(slidesPath)), ref))) diagnostics.push({ severity: 'error', code: 'missing-asset', message: `Missing local asset: ${ref}`, line: 1, column: 1 })
  }
  for (const folder of componentFolders(slidesPath, source).filter(folder => folder.source === 'shared')) {
    if (!isFolder(folder.dir)) diagnostics.push({ severity: 'error', code: 'missing-components', message: `Components folder not found: ${folder.path} (${folder.dir})`, line: 1, column: 1 })
  }
  // The deck's drawings file: readable, and only for slides that still exist.
  const inkPath = inkFileFor(resolve(slidesPath))
  const oldInkPath = oldInkFileFor(resolve(slidesPath))
  if (!existsSync(inkPath) && existsSync(oldInkPath)) diagnostics.push({ severity: 'error', code: 'renamed-file', message: `${basename(oldInkPath)} is now ${basename(inkPath)}: rename the file to keep your drawings`, line: 1, column: 1 })
  if (existsSync(inkPath)) {
    let raw = null
    try { raw = JSON.parse(readFileSync(inkPath, 'utf8')) } catch (error) { diagnostics.push({ severity: 'error', code: 'invalid-ink', message: `The drawings file is not valid JSON: ${error.message}`, line: 1, column: 1 }) }
    if (raw) {
      for (const problem of validateInk(raw)) diagnostics.push({ severity: 'warning', code: 'invalid-ink', message: `Drawings file: ${problem.message}`, line: 1, column: 1 })
      for (const id of orphanIds(normalizeInk(raw), deck.slides)) diagnostics.push({ severity: 'warning', code: 'ink-orphan', message: `The drawings file has drawings for slide "${id}", which is not in the deck`, line: 1, column: 1 })
    }
  }
  return { deck, diagnostics }
}
