// Deck validation shared by `mdeck check` and the launch page: source
// diagnostics plus local files the deck refers to but that are missing.
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { parseSlides } from '../core/parseSlides.js'
import { validateDeck } from '../core/validateDeck.js'
import { manifestsOf } from '../extensions/discover.js'
import { collectLocalAssetRefs } from './slidesPlugin.js'
import { componentFolders, isFolder } from './components.js'

export function checkDeck(slidesPath, registry, source = readFileSync(slidesPath, 'utf8')) {
  const deck = parseSlides(source)
  const diagnostics = validateDeck(deck, { templates: manifestsOf(registry, 'template'), themes: manifestsOf(registry, 'theme'), palettes: manifestsOf(registry, 'palette') })
  for (const ref of collectLocalAssetRefs(source)) {
    if (!existsSync(resolve(dirname(resolve(slidesPath)), ref))) diagnostics.push({ severity: 'error', code: 'missing-asset', message: `Missing local asset: ${ref}`, line: 1, column: 1 })
  }
  for (const folder of componentFolders(slidesPath, source).filter(folder => folder.source === 'shared')) {
    if (!isFolder(folder.dir)) diagnostics.push({ severity: 'error', code: 'missing-components', message: `Components folder not found: ${folder.path} (${folder.dir})`, line: 1, column: 1 })
  }
  return { deck, diagnostics }
}
