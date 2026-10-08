import { readFileSync, statSync, existsSync } from 'fs'
import { resolve, dirname, extname, basename } from 'path'
import yaml from 'js-yaml'
import { parseSlides } from '../core/parseSlides.js'
import { scanCitations, citedKeys } from '../core/citations.js'
import { sampleDeck, SAMPLE_REFERENCES, SAMPLE_REFERENCES_FILE } from '../editor/sampleDeck.js'

// The deck's references, formatted here in Node with citeproc so that none of
// it travels in the deck: the page receives finished HTML for every citation
// as written, the full entry of every cited work, and the reference list.
//
// Reference files: BibTeX/BibLaTeX (.bib), CSL-JSON (.json), and YAML (.yml,
// .yaml) holding either Hayagriva (Typst's format, a map of entries) or
// CSL-YAML (a list of entries with ids).

export const bibliographyFiles = (deckPath, deckConfig = {}) =>
  [deckConfig.bibliography ?? []].flat().filter(file => typeof file === 'string' && file).map(file => resolve(dirname(resolve(deckPath)), file))

export const styleFile = (deckPath, deckConfig = {}) =>
  typeof deckConfig.csl === 'string' && /\.csl$/i.test(deckConfig.csl) ? resolve(dirname(resolve(deckPath)), deckConfig.csl) : null

// ─── Reading reference files ──────────────────────────────────────────────

const parsed = new Map()

async function readItems(file) {
  const { mtimeMs } = statSync(file)
  const cached = parsed.get(file)
  if (cached?.mtimeMs === mtimeMs) return cached.items
  const items = await parseReferences(readFileSync(file, 'utf-8'), extname(file))
  parsed.set(file, { mtimeMs, items })
  return items
}

// Reference file text as CSL-JSON items; `ext` names the format.
export async function parseReferences(text, ext) {
  ext = ext.toLowerCase()
  let items
  if (ext === '.json') items = JSON.parse(text)
  else if (ext === '.yml' || ext === '.yaml') {
    // The core schema keeps dates as written (2003-06-21), not as Date objects.
    const doc = yaml.load(text, { schema: yaml.CORE_SCHEMA })
    items = Array.isArray(doc) ? doc : hayagrivaToCsl(doc ?? {})
  } else if (ext === '.bib' || ext === '.bibtex') {
    const { Cite } = await import('@citation-js/core')
    await import('@citation-js/plugin-bibtex')
    items = new Cite(text, { forceType: '@biblatex/text' }).data
  } else throw new Error(`unknown reference format "${ext}" (use .bib, .json or .yml)`)
  if (!Array.isArray(items)) throw new Error('expected a list of references')
  return items.filter(item => item && item.id != null).map(item => ({ ...item, id: String(item.id) }))
}

// `sample`: the sample deck's references stand in for a missing file of
// theirs (the dev and edit servers show the sample deck without a folder).
export async function loadBibliography(files, { sample = false } = {}) {
  const items = []
  const seen = new Set()
  const diagnostics = []
  for (const file of files) {
    let found
    try {
      found = sample && basename(file) === SAMPLE_REFERENCES_FILE && !existsSync(file) ? await parseReferences(SAMPLE_REFERENCES, '.bib') : await readItems(file)
    } catch (error) {
      diagnostics.push({ severity: 'warning', code: 'bibliography-file', message: error.code === 'ENOENT' ? `Bibliography ${file} not found` : `Bibliography ${file}: ${error.message}` })
      continue
    }
    for (const item of found) {
      if (seen.has(item.id)) { diagnostics.push({ severity: 'warning', code: 'bibliography-duplicate', message: `Reference "${item.id}" appears twice; using the first (${file})` }); continue }
      seen.add(item.id)
      items.push(item)
    }
  }
  return { items, diagnostics }
}

// ─── Hayagriva → CSL-JSON ─────────────────────────────────────────────────

const text = value => value == null ? undefined : typeof value === 'object' && !Array.isArray(value) ? text(value.value) : String(value)

function person(value) {
  if (value && typeof value === 'object') {
    return { family: value.name, given: value['given-name'], 'non-dropping-particle': value.prefix, suffix: value.suffix }
  }
  const parts = String(value).split(',').map(part => part.trim())
  if (parts.length === 1) return { literal: parts[0] }
  const [family, given, suffix] = parts
  const particle = family.match(/^((?:[a-z]+\s+)+)(.+)$/)
  return particle ? { 'non-dropping-particle': particle[1].trim(), family: particle[2], given, suffix } : { family, given, suffix }
}
const people = value => value == null ? undefined : [value].flat().map(person)

function date(value) {
  if (value == null) return undefined
  const parts = String(value).match(/^(-?\d{1,4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/)
  return parts ? { 'date-parts': [parts.slice(1).filter(Boolean).map(Number)] } : { literal: String(value) }
}

const kind = value => String(value ?? 'misc').toLowerCase()

function cslType(type, parentType) {
  if (type === 'article') return { periodical: 'article-journal', newspaper: 'article-newspaper', proceedings: 'paper-conference', conference: 'paper-conference', blog: 'post-weblog', web: 'webpage', book: 'chapter', anthology: 'chapter' }[parentType] ?? 'article-journal'
  return {
    book: 'book', anthology: 'book', proceedings: 'book', chapter: 'chapter', anthos: 'chapter', thesis: 'thesis', report: 'report',
    web: 'webpage', blog: 'post-weblog', thread: 'post', video: 'motion_picture', audio: 'song', repository: 'software',
    patent: 'patent', case: 'legal_case', legislation: 'legislation', manuscript: 'manuscript', newspaper: 'article-newspaper',
    periodical: 'periodical', reference: 'entry-encyclopedia', entry: 'entry', artwork: 'graphic', performance: 'performance',
    exhibition: 'event', conference: 'event', original: 'document', misc: 'document',
  }[type] ?? 'document'
}

function publisher(value) {
  if (value == null) return {}
  if (typeof value === 'object') return { publisher: text(value.name), 'publisher-place': text(value.location) }
  return { publisher: String(value) }
}

const clean = object => Object.fromEntries(Object.entries(object).filter(([, value]) => value != null && value !== '' && !(Array.isArray(value) && !value.length)))

export function hayagrivaToCsl(doc) {
  return Object.entries(doc).map(([id, entry]) => {
    entry ??= {}
    const parent = [entry.parent ?? []].flat()[0] ?? {}
    const serial = { ...(typeof parent['serial-number'] === 'object' ? parent['serial-number'] : {}), ...(typeof entry['serial-number'] === 'object' ? entry['serial-number'] : {}) }
    const url = entry.url ?? parent.url
    return clean({
      id,
      type: cslType(kind(entry.type), parent.type ? kind(parent.type) : undefined),
      title: text(entry.title),
      'title-short': typeof entry.title === 'object' ? text(entry.title.short) : undefined,
      author: people(entry.author),
      editor: people(entry.editor ?? parent.editor),
      translator: people(entry.translator),
      issued: date(entry.date ?? parent.date),
      'container-title': text(parent.title),
      'collection-title': text([parent.parent ?? []].flat()[0]?.title),
      volume: text(entry.volume ?? parent.volume),
      issue: text(entry.issue ?? parent.issue),
      page: text(entry['page-range'] ?? parent['page-range']),
      edition: text(entry.edition ?? parent.edition),
      ...publisher(entry.publisher ?? parent.publisher),
      'publisher-place': text(entry.location ?? parent.location) ?? publisher(entry.publisher ?? parent.publisher)['publisher-place'],
      genre: text(entry.genre),
      'event-title': kind(parent.type) === 'conference' ? text(parent.title) : undefined,
      DOI: text(serial.doi),
      ISBN: text(serial.isbn),
      ISSN: text(serial.issn),
      PMID: text(serial.pmid),
      number: typeof entry['serial-number'] === 'string' ? entry['serial-number'] : undefined,
      URL: text(url),
      accessed: typeof url === 'object' ? date(url.date) : undefined,
      language: text(entry.language),
      note: text(entry.note),
      abstract: text(entry.abstract),
      ...(entry.organization && !entry.publisher ? { publisher: text(entry.organization) } : {}),
    })
  })
}

// ─── Formatting ───────────────────────────────────────────────────────────

// The texts a deck shows, in the order the audience sees them: each slide's
// regions, then its notes. The runtime renders citations in the same texts.
export function deckTexts(source) {
  const { slides } = parseSlides(source)
  const position = region => region.source?.start ?? region.ranges?.[0]?.start ?? 0
  return slides.flatMap(slide => [
    ...Object.values(slide.regions ?? { body: { content: slide.content } }).sort((a, b) => position(a) - position(b)).map(region => region.content ?? ''),
    slide.meta?.notes ?? '',
  ])
}

function pickLocale(lang, available) {
  if (!lang) return 'en-US'
  const wanted = String(lang).replace('_', '-')
  const exact = available.find(id => id.toLowerCase() === wanted.toLowerCase())
  if (exact) return exact
  const language = wanted.split('-')[0].toLowerCase()
  return available.find(id => id.toLowerCase().startsWith(language + '-')) ?? null
}

// A name for a narrative citation when the style has no author-only form
// (numeric styles): Smith, Smith and Doe, Smith et al.
function namesOf(item) {
  const names = (item.author ?? item.editor ?? []).map(name => name.family ?? name.literal).filter(Boolean)
  if (!names.length) return item['title-short'] ?? item.title ?? item.id
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} &amp; ${names[1]}`
  return `${names[0]} et al.`
}

const toCiteItem = item => clean({ id: item.id, locator: item.locator, label: item.locator ? item.label : undefined, prefix: item.prefix, suffix: item.suffix, 'suppress-author': item.suppressAuthor || undefined })

// `{ ids, clusters, singles, entries, order, diagnostics }`: `clusters` maps
// each citation as written to its HTML; `singles` and `entries` map keys to a
// one-work citation and to the full reference; `order` is the reference list.
export async function formatBibliography({ items, texts, csl, lang, nocite = [], deckDir = '.' }) {
  const diagnostics = []
  const byId = new Map(items.map(item => [item.id, item]))
  const result = { ids: [...byId.keys()], clusters: {}, singles: {}, entries: {}, order: [], diagnostics }

  const clusters = texts.flatMap(text => scanCitations(text, { isKey: id => byId.has(id) }))
  const unknown = new Set(clusters.flatMap(cluster => cluster.items.map(item => item.id)).filter(id => !byId.has(id)))
  for (const id of unknown) diagnostics.push({ severity: 'warning', code: 'citation-unknown', message: `Citation @${id} is not in the bibliography` })

  const wanted = [nocite].flat().map(id => String(id).replace(/^@/, ''))
  const uncited = wanted.includes('*') ? [...byId.keys()] : wanted.filter(id => {
    if (byId.has(id)) return true
    diagnostics.push({ severity: 'warning', code: 'citation-unknown', message: `nocite: ${id} is not in the bibliography` })
    return false
  })
  if (!clusters.length && !uncited.length) return result

  const { plugins } = await import('@citation-js/core')
  await import('@citation-js/plugin-csl')
  const { default: CSL } = await import('citeproc')
  const config = plugins.config.get('@csl')

  let style = config.styles.get('apa')
  const styleName = csl ?? 'apa'
  if (/\.csl$/i.test(styleName)) {
    try { style = readFileSync(resolve(deckDir, styleName), 'utf-8') } catch (error) {
      diagnostics.push({ severity: 'warning', code: 'citation-style', message: `Citation style ${styleName}: ${error.code === 'ENOENT' ? 'file not found' : error.message}; using apa` })
    }
  } else if (config.styles.has(styleName)) style = config.styles.get(styleName)
  else diagnostics.push({ severity: 'warning', code: 'citation-style', message: `Unknown citation style "${styleName}" (built in: ${config.styles.list().join(', ')}, or a .csl file); using apa` })

  let locale = pickLocale(lang, config.locales.list())
  if (!locale) {
    diagnostics.push({ severity: 'warning', code: 'citation-locale', message: `No citation locale for "${lang}" (available: ${config.locales.list().join(', ')}); using en-US` })
    locale = 'en-US'
  }

  let engine
  try {
    engine = new CSL.Engine({
      retrieveItem: id => byId.get(id),
      retrieveLocale: id => config.locales.get(id) ?? config.locales.get('en-US'),
    }, style, locale, true)
  } catch (error) {
    diagnostics.push({ severity: 'warning', code: 'citation-style', message: `Citation style ${styleName}: ${error.message}` })
    return result
  }
  engine.setOutputFormat('html')
  engine.opt.development_extensions.wrap_url_and_doi = true

  // In order, so numbering and disambiguation (2020a, 2020b) come out right.
  const html = new Map()
  const done = []
  clusters.forEach((cluster, index) => {
    // A mixed citation formats its known works; the runtime marks the others.
    const known = cluster.items.filter(item => byId.has(item.id))
    if (!known.length) return
    const citationItems = known.map(item => toCiteItem(cluster.narrative ? { ...item, suppressAuthor: true } : item))
    const citation = { citationID: `c${index}`, citationItems, properties: { noteIndex: 0 } }
    const [, updates] = engine.processCitationCluster(citation, done, [])
    done.push([citation.citationID, 0])
    for (const [, text, id] of updates) html.set(id, text)
  })
  clusters.forEach((cluster, index) => {
    const text = html.get(`c${index}`)
    if (text == null || Object.hasOwn(result.clusters, cluster.raw)) return
    if (!cluster.narrative) { result.clusters[cluster.raw] = text; return }
    const { id } = cluster.items[0]
    let author = engine.makeCitationCluster([{ id, 'author-only': true }])
    if (!author || /NO_PRINTED_FORM/.test(author)) author = namesOf(byId.get(id))
    result.clusters[cluster.raw] = `${author} ${text}`
  })

  const cited = citedKeys(clusters).filter(id => byId.has(id))
  for (const id of cited) result.singles[id] = engine.makeCitationCluster([{ id }])
  if (uncited.length) engine.updateUncitedItems(uncited)
  const bibliography = engine.makeBibliography()
  if (!bibliography) {
    diagnostics.push({ severity: 'warning', code: 'citation-style', message: `Citation style ${styleName} has no reference list` })
    return result
  }
  const [meta, entries] = bibliography
  meta.entry_ids.forEach(([id], i) => {
    result.entries[id] = entries[i].trim()
    result.order.push(id)
  })
  return result
}

// Everything the deck's `bibliography`, `csl`, `nocite` and `lang` ask for,
// or null when the deck has no bibliography.
export async function resolveBibliography(deckPath, source, { sample = false } = {}) {
  let deckConfig
  try { deckConfig = parseSlides(source).deckConfig ?? {} } catch { return null }
  const files = bibliographyFiles(deckPath, deckConfig)
  if (!files.length) return null
  const loaded = await loadBibliography(files, { sample })
  const formatted = await formatBibliography({
    items: loaded.items, texts: deckTexts(source), csl: deckConfig.csl, lang: deckConfig.lang,
    nocite: deckConfig.nocite ?? [], deckDir: dirname(resolve(deckPath)),
  })
  return { ...formatted, diagnostics: [...loaded.diagnostics, ...formatted.diagnostics], files, style: styleFile(deckPath, deckConfig) }
}

// The sample deck's citations, formatted once: the design page previews it
// in the editor of any deck, whose own references are another matter.
let sampleFormatted = null
export function sampleBibliography() {
  sampleFormatted ??= parseReferences(SAMPLE_REFERENCES, '.bib')
    .then(items => formatBibliography({ items, texts: deckTexts(sampleDeck()) }))
  return sampleFormatted
}
