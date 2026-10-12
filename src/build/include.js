// Decks made of other decks. A slide that is nothing but
//
//   :::include ./lectures/02-graphs.md
//   :::include ./lectures/02-graphs.md slides=3-7
//
// stands for the slides of that file (core/parseSlides.js includeOf), which
// stays a deck of its own: `mdeck run 02-graphs.md` presents it alone, and its
// settings (theme, title, time …) count only then; included, only its slides
// are taken. `slides=` keeps some of them, numbered as that file shows them.
//
// Everything that reads a deck to show it reads it through expandDeck, which
// puts the slides in place of the include: the dev server, builds, `mdeck
// check`, the launch page. What writes into a deck (the editor, saved times,
// slide ids for drawings) writes into the file a slide is written in; the
// editor shows an include as a card naming the file.
//
// So that a slide keeps its drawings however many slides come before it, the
// expanded deck gives every slide an id: a slide of the deck itself keeps the
// one it has in its file (slide-3 stays slide-3), an included slide gets its
// file's name in front (graphs-slide-3, graphs-dijkstra). `origins` says, for
// each such id, the file the slide is written in and its id there.
//
// Paths of pictures and media in an included file are written from its own
// folder; they are rewritten to work from the deck's. A deck in several
// languages (talk.de.md) takes an included file's twin in its language
// (02-graphs.de.md) where there is one.
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname, relative, basename, sep } from 'node:path'
import { parseSlides } from '../core/parseSlides.js'
import { setSlideMeta, shareSlides } from '../core/editDeck.js'
import { diagnostic } from '../core/source.js'
import { languageOfFile } from '../core/languages.js'
import { parseSlideNumbers } from '../cli/args.js'
import { rewriteAssetRefs } from './slidesPlugin.js'

const read = file => readFileSync(file, 'utf8')

/** Whether the deck text has an include at all. */
export const hasIncludes = source => parseSlides(source).slides.some(slide => slide.include)

/**
 * The deck in `file` (or `source`, its text) with its includes in place:
 * { source, files, origins, diagnostics }. `files` are the included files
 * (to watch), `origins` maps each slide id to { file, id } (null when the
 * deck includes nothing), `diagnostics` are problems with the includes:
 * { file, line, severity, code, message }. Without includes, `source` is
 * the deck's text unchanged.
 */
export function expandDeck(file, { source = null, lang = null } = {}) {
  const abs = resolve(file)
  const text = source ?? read(abs)
  if (!hasIncludes(text)) return { source: text, files: [], origins: null, diagnostics: [] }
  const deck = parseSlides(text)
  const state = { root: dirname(abs), files: new Set(), diagnostics: [], prefixes: new Set(), origins: {} }
  const language = lang ?? languageOfFile(basename(abs))?.lang ?? (typeof deck.deckConfig.lang === 'string' ? deck.deckConfig.lang : null)
  const expanded = expandFile(abs, text, { state, language, stack: [abs], prefix: null, top: true })
  return { source: expanded, files: [...state.files], origins: state.origins, diagnostics: state.diagnostics }
}

/** The deck's text with its includes in place, or its text as it is when there are none. */
export const expandedSource = (file, options) => expandDeck(file, options).source

// One file's slides, ids given, its own includes in place, paths written from
// the deck's folder; the top file keeps its settings in front.
function expandFile(abs, source, { state, language, stack, prefix, top }) {
  let deck = parseSlides(source)
  // Where each include is written, for messages, before ids change the lines.
  const lines = deck.slides.filter(slide => slide.include).map(slide => {
    const at = slide.source.start + source.slice(slide.source.start, slide.source.end).indexOf(':::')
    return diagnostic(source, '', '', at).line
  })
  // Each slide gets the id it has in its own file, written out, with the
  // file's name in front when it is included.
  for (const slide of [...deck.slides]) {
    if (slide.include) continue
    const own = slide.id
    const id = prefix ? `${prefix}-${own}` : own
    state.origins[id] = { file: abs, id: own }
    if (slide.meta.id === id) continue
    source = setSlideMeta(deck, own, { id })
    deck = parseSlides(source)
  }
  const fromHere = dirname(abs)
  const moved = fromHere !== state.root
  const own = text => moved ? rewriteAssetRefs(text, ref => relative(state.root, resolve(fromHere, ref)).split(sep).join('/')) : text
  let included = 0
  const chunks = deck.slides.map(slide => {
    const text = deck.source.slice(slide.source.start, slide.source.end)
    if (!slide.include) return own(text)
    return includeText(abs, slide, lines[included++], { state, language, stack, prefix }) ?? own(text)
  }).filter(chunk => chunk.trim())
  const body = chunks.map(chunk => chunk.replace(/^\s*\n/, '').replace(/\s*$/, '\n')).join('\n---\n\n')
  return top ? deck.source.slice(0, deck.slides[0]?.source.start ?? 0) + body : body
}

// The slides an include stands for, or null (with a diagnostic) when they cannot be had.
function includeText(abs, slide, line, { state, language, stack, prefix }) {
  const { file, slides } = slide.include
  const problem = (code, message) => {
    state.diagnostics.push({ file: abs, line, severity: 'error', code, message })
    return null
  }
  const target = chooseFile(dirname(abs), file, language)
  if (!existsSync(target)) return problem('missing-include', `Included file not found: ${file}`)
  if (stack.includes(target)) return problem('include-loop', `${file} includes this file again (${[...stack, target].map(f => basename(f)).join(' → ')})`)
  let numbers = null
  if (slides != null) {
    try { numbers = parseSlideNumbers(slides) } catch (error) { return problem('invalid-include', error.message.replace('--slide', 'slides=')) }
  }
  state.files.add(target)
  const childPrefix = uniquePrefix(state, prefix, target)
  let text = expandFile(target, read(target), { state, language, stack: [...stack, target], prefix: childPrefix, top: false })
  if (numbers) {
    try { text = shareSlides(text, { slides: numbers }).source } catch (error) { return problem('invalid-include', `${file}: ${error.message}`) }
  }
  return text
}

// The file in the deck's language where there is one: ./02-graphs.md in a
// German deck is ./02-graphs.de.md beside it.
function chooseFile(dir, ref, language) {
  const abs = resolve(dir, ref)
  if (language && /\.md$/i.test(abs) && !languageOfFile(basename(abs))) {
    const twin = abs.replace(/\.md$/i, `.${language}.md`)
    if (existsSync(twin)) return twin
  }
  return abs
}

// An id prefix from the file's name, unique in the deck: 02-graphs.md → graphs.
function uniquePrefix(state, parent, file) {
  const name = languageOfFile(basename(file))?.name ?? basename(file).replace(/\.md$/i, '')
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^[^a-z]+|-+$/g, '') || 'part'
  const full = parent ? `${parent}-${base}` : base
  let prefix = full, n = 2
  while (state.prefixes.has(prefix)) prefix = `${full}-${n++}`
  state.prefixes.add(prefix)
  return prefix
}

/**
 * An included file's problems without those in its settings, which count
 * only when it is shown alone (its theme need not be installed for the
 * deck that includes it).
 */
export function withoutSettings(source, diagnostics) {
  const range = parseSlides(source).configSource
  if (!range) return diagnostics
  return diagnostics.filter(d => d.offset == null || d.offset < range.start || d.offset > range.end)
}

/** Include problems as lines for the terminal, file:line: severity [code] message. */
export const formatIncludeDiagnostics = diagnostics => diagnostics.map(d => `${d.file}:${d.line}:1: ${d.severity} [${d.code}] ${d.message}`).join('\n')
