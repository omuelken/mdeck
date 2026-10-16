// Deck validation shared by `mdeck check` and the launch page: source
// diagnostics plus local files the deck refers to but that are missing.
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { drawingsDiagnostic } from './drawings.js'
import { parseSlides } from '../core/parseSlides.js'
import { validateDeck } from '../core/validateDeck.js'
import { manifestsOf } from '../extensions/discover.js'
import { paletteProblems } from '../extensions/contrast.js'
import { collectLocalAssetRefs, lineNaming } from './slidesPlugin.js'
import { componentFolders, isFolder } from './components.js'
import { inkFileFor, validateInk, normalizeInk, orphanIds } from '../core/ink.js'
import { resolveBibliography } from './bibliography.js'
import { svgProblems } from './svgCheck.js'
import { expandDeck, withoutSettings } from './include.js'
import { dataDiagnostics } from './dataCheck.js'

// A deck that includes others (include.js) is checked file by file, each
// message naming its file; `deck` is the deck as shown, every slide in place.
export function checkDeck(slidesPath, registry, source = readFileSync(slidesPath, 'utf8'), { includes = true } = {}) {
  let deck = parseSlides(source)
  const diagnostics = validateDeck(deck, { layouts: manifestsOf(registry, 'layout'), themes: manifestsOf(registry, 'theme'), palettes: manifestsOf(registry, 'palette') })
  for (const ref of collectLocalAssetRefs(source)) {
    const file = resolve(dirname(resolve(slidesPath)), ref)
    const line = lineNaming(source, ref)
    if (!existsSync(file)) { diagnostics.push({ severity: 'error', code: 'missing-asset', message: `Missing local asset: ${ref}`, line, column: 1 }); continue }
    if (!/\.svg$/i.test(ref)) continue
    for (const problem of svgProblems(readFileSync(file, 'utf8'))) diagnostics.push({ severity: 'warning', code: problem.code, message: `${ref} ${problem.message}`, line, column: 1 })
  }
  diagnostics.push(...dataDiagnostics(slidesPath, registry, source))
  for (const folder of componentFolders(slidesPath, source).filter(folder => folder.source === 'shared')) {
    if (!isFolder(folder.dir)) diagnostics.push({ severity: 'error', code: 'missing-components', message: `Components folder not found: ${folder.path} (${folder.dir})`, line: 1, column: 1 })
  }
  // The deck's own palettes: colours too close to read are worth knowing
  // before the talk (the built-in ones are held to this by the tests).
  for (const record of Object.values(registry.palettes)) {
    if (record.source !== 'local') continue
    for (const problem of paletteProblems(record.manifest)) diagnostics.push({ severity: 'warning', code: 'palette-contrast', message: `Palette "${record.id}", ${problem}`, line: 1, column: 1 })
    for (const role of record.manifest.fallbacks ?? []) diagnostics.push({ severity: 'warning', code: 'palette-fallback', message: `Palette "${record.id}" sets no ${role}, so it gets mdeck's amber; give it a colour of its own in [light] and [dark]`, line: 1, column: 1 })
  }
  if (includes) {
    const expansion = expandDeck(slidesPath, { source })
    diagnostics.push(...expansion.diagnostics)
    // The look in an included deck's settings counts only when it is shown
    // alone; its palettes are the including deck's.
    const ownOnly = new Set(['palette-contrast', 'palette-fallback'])
    for (const file of expansion.files) {
      const text = readFileSync(file, 'utf8')
      for (const d of withoutSettings(text, checkDeck(file, registry, text, { includes: false }).diagnostics)) if (!ownOnly.has(d.code)) diagnostics.push({ ...d, file: d.file ?? file })
    }
    deck = parseSlides(expansion.source)
  }
  // The deck's drawings file: readable, and only for slides that still exist.
  const inkPath = inkFileFor(resolve(slidesPath))
  const renamed = drawingsDiagnostic(slidesPath)
  if (renamed) diagnostics.push(renamed)
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

// What the deck's references cannot use: missing or unreadable files, an
// unknown style or language, citations of keys the files do not have.
// Citations in included decks are checked too, against the references they
// bring along (include.js), and named at their file and line.
export async function bibliographyDiagnostics(slidesPath, source = readFileSync(slidesPath, 'utf8')) {
  const expansion = expandDeck(slidesPath, { source })
  const bibliography = await resolveBibliography(slidesPath, expansion.source)
  const texts = [[null, source], ...expansion.files.map(file => [file, readFileSync(file, 'utf8')])]
  return (bibliography?.diagnostics ?? []).map(d => {
    const key = d.code === 'citation-unknown' ? '@' + d.message.match(/@(\S+)/)?.[1] : null
    const [file, text] = (key && texts.find(([, text]) => text.includes(key))) || [null, source]
    const at = key ? text.indexOf(key) : -1
    const line = at < 0 ? 1 : text.slice(0, at).split('\n').length
    return { ...d, line, column: 1, ...(file ? { file } : {}) }
  })
}
