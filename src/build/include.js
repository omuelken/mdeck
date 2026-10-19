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
// What an included deck's slides need from its settings comes along; how
// it looks and is presented stays the including deck's. `hotspots` and
// `time` become each included slide's own, unless it has one: a slide
// without a time gets its share of the included deck's `time`. The
// references (`bibliography`, `nocite`, and `csl` when the deck has none),
// the `components` folders (and a components/ folder beside the file) and
// callout names of its own (`callouts`, where the deck does not name them)
// are added to the including deck's settings. Theme, palette, size,
// language, labels, `show`, `meta` and the server stay the including deck's.
//
// Paths of pictures and media in an included file are written from its own
// folder; they are rewritten to work from the deck's. A deck in several
// languages (talk.de.md) takes an included file's twin in its language
// (02-graphs.de.md) where there is one.
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname, relative, basename, sep } from 'node:path'
import { parseSlides } from '../core/parseSlides.js'
import { setSlideMeta, setDeckConfig, shareSlides } from '../core/editDeck.js'
import { diagnostic } from '../core/source.js'
import { languageOfFile } from '../core/languages.js'
import { planFor, formatTime } from '../core/timing.js'
import { CALLOUT_TYPES } from '../core/labels.js'
import { isPlainObject, DECK_KEYS, SLIDE_KEYS } from '../core/parseSlides.js'
import { parseSlideNumbers } from '../cli/args.js'
import { rewriteAssetRefs, lineNaming } from './slidesPlugin.js'
import { deckTexts } from './bibliography.js'
import { scanCitations, citedKeys } from '../core/citations.js'
import { replaceTagsIn } from '../core/tags.js'

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
  const state = { root: dirname(abs), files: new Set(), diagnostics: [], prefixes: new Set(), origins: {}, settings: [] }
  const language = lang ?? languageOfFile(basename(abs))?.lang ?? (typeof deck.deckConfig.lang === 'string' ? deck.deckConfig.lang : null)
  let expanded = expandFile(abs, text, { state, language, stack: [abs], prefix: null, top: true })
  const patch = addedSettings(deck.deckConfig, state)
  if (patch) expanded = setDeckConfig(parseSlides(expanded), patch)
  return { source: expanded, files: [...state.files], origins: state.origins, diagnostics: state.diagnostics }
}

/** The deck's text with its includes in place, or its text as it is when there are none. */
export const expandedSource = (file, options) => expandDeck(file, options).source

// One file's slides, ids given, its own includes in place, paths written from
// the deck's folder; the top file keeps its settings in front.
function expandFile(abs, source, { state, language, stack, prefix, top }) {
  const written = source
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
  // A file outside the deck's folder (../pictures/x.png from the deck) is not
  // copied by a build, nor seen by check --render and snapshot: say so, once.
  const outside = new Set()
  const fromRoot = ref => {
    const next = relative(state.root, resolve(fromHere, ref)).split(sep).join('/')
    if (next.startsWith('../') && !outside.has(ref)) {
      outside.add(ref)
      state.diagnostics.push({ file: abs, line: lineNaming(written, ref), severity: 'warning', code: 'asset-outside-deck', message: `${ref} is outside the folder of the deck that includes this file (${next}), so a build of the deck, check --render and snapshot leave it out; move it into that folder` })
    }
    return next
  }
  const own = text => moved ? rewriteAssetRefs(text, fromRoot) : text
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
  const source = read(target)
  const settings = parseSlides(source).deckConfig ?? {}
  state.settings.push({ file: target, settings })
  // `time:` or `hotspots:` alone at the top is the file's, for all its
  // slides; meant for its first slide, it belongs in a :::meta block.
  const keys = Object.keys(settings)
  if (keys.length && keys.every(key => DECK_KEYS.has(key) && SLIDE_KEYS.has(key)) && !state.diagnostics.some(d => d.file === target && d.code === 'include-settings')) {
    state.diagnostics.push({ file: target, line: 1, severity: 'warning', code: 'include-settings', message: `The block at the top (${keys.join(', ')}) is read as this file's settings, for all its slides; for its first slide alone, write it in a :::meta block` })
  }
  let text = ownReferences(inherit(expandFile(target, source, { state, language, stack: [...stack, target], prefix: childPrefix, top: false }), settings), settings)
  if (numbers) {
    try { text = shareSlides(text, { slides: numbers }).source } catch (error) { return problem('invalid-include', `${file}: ${error.message}`) }
  }
  return text
}

// The included deck's `hotspots` and `time`, as each of its slides' own
// where it has none; `time` is shared out as the deck itself would (its
// slides' own times first, the rest in equal parts).
function inherit(text, { hotspots, time }) {
  if (hotspots == null && time == null) return text
  let deck = parseSlides(text)
  const plan = time == null ? null : planFor(deck.slides, { time })
  for (const [i, slide] of [...deck.slides].entries()) {
    if (slide.include) continue
    const patch = {}
    if (hotspots != null && slide.meta.hotspots == null) patch.hotspots = hotspots
    if (plan?.budget && slide.meta.time == null && plan.perSlide[i] >= 1) patch.time = formatTime(plan.perSlide[i])
    if (!Object.keys(patch).length) continue
    text = setSlideMeta(deck, slide.id, patch)
    deck = parseSlides(text)
  }
  return text
}

// An included deck's <bibliography /> lists the works that deck cites (and
// its `nocite`), as it does when shown alone, not every work the including
// deck cites: it gets them as `keys`. With `nocite: '*'` it lists them all.
function ownReferences(text, { nocite }) {
  const named = [nocite ?? []].flat().map(key => String(key).replace(/^@/, ''))
  if (!/<bibliography\b/.test(text) || named.includes('*')) return text
  const keys = [...new Set([...citedKeys(deckTexts(text).flatMap(part => scanCitations(part))), ...named])].join(' ')
  return replaceTagsIn(text, tag => {
    if (tag.closing || tag.name !== 'bibliography' || 'keys' in tag.attrs) return
    return tag.raw.replace(/(\s*)(\/?>)$/, ` keys="${keys}"$1$2`)
  })
}

// What the included decks add to the including deck's settings, or null.
function addedSettings(config, { root, settings: included }) {
  const fromRoot = (file, path) => {
    if (typeof path !== 'string' || !path.trim()) return null
    const trimmed = path.trim()
    if (trimmed === '~' || trimmed.startsWith('~/') || trimmed.startsWith('/')) return trimmed
    return relative(root, resolve(dirname(file), trimmed)).split(sep).join('/') || '.'
  }
  const list = value => [value ?? []].flat()
  const patch = {}
  const bibliography = list(config.bibliography)
  const nocite = list(config.nocite)
  const components = list(config.components)
  const callouts = isPlainObject(config.callouts) ? { ...config.callouts } : {}
  const known = new Set([...CALLOUT_TYPES, ...Object.keys(callouts)].map(name => name.toLowerCase()))
  let csl = config.csl ?? null
  for (const { file, settings } of included) {
    for (const path of list(settings.bibliography)) { const own = fromRoot(file, path); if (own && !bibliography.includes(own)) bibliography.push(own) }
    for (const key of list(settings.nocite)) if (!nocite.includes(key)) nocite.push(key)
    if (csl == null && typeof settings.csl === 'string') csl = patch.csl = /\.csl$/i.test(settings.csl) ? fromRoot(file, settings.csl) : settings.csl
    const folders = [...list(settings.components), ...(existsSync(resolve(dirname(file), 'components')) ? ['components'] : [])]
    for (const path of folders) { const own = fromRoot(file, path); if (own && !components.includes(own) && resolve(root, own) !== resolve(root, 'components')) components.push(own) }
    if (isPlainObject(settings.callouts)) {
      for (const [name, title] of Object.entries(settings.callouts)) {
        if (known.has(name.toLowerCase())) continue
        callouts[name] = title
        known.add(name.toLowerCase())
      }
    }
  }
  if (bibliography.length > list(config.bibliography).length) patch.bibliography = bibliography
  if (nocite.length > list(config.nocite).length) patch.nocite = nocite
  if (components.length > list(config.components).length) patch.components = components
  if (Object.keys(callouts).length > Object.keys(isPlainObject(config.callouts) ? config.callouts : {}).length) patch.callouts = callouts
  return Object.keys(patch).length ? patch : null
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
