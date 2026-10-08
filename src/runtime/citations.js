import initial, { sample as initialSample } from 'virtual:bibliography'
import { scanCitations } from '../core/citations.js'
import { SAMPLE_REFERENCES_FILE } from '../editor/sampleDeck.js'
import '../components/citation.css'

// The deck's formatted references (built by src/build/bibliography.js), or
// null without a `bibliography`. The editor receives new ones as the deck or
// its reference file changes.
let bibliography = initial
// The sample deck's, on the dev and edit servers (the design page shows it).
let sample = initialSample ?? null
let showsSample = false
const listeners = new Set()

// The references of the deck on screen: the sample deck's for the sample.
export const currentBibliography = () => showsSample && sample ? sample : bibliography
export function bibliographyOf(deckConfig) {
  showsSample = [deckConfig?.bibliography].flat().includes(SAMPLE_REFERENCES_FILE)
  return currentBibliography()
}
export function onBibliography(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

if (import.meta.hot) {
  import.meta.hot.accept('virtual:bibliography', next => {
    if (!next) return
    bibliography = next.default
    sample = next.sample ?? null
    for (const listener of listeners) listener(currentBibliography())
  })
}

const escape = text => String(text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

// A citation the build has not formatted: one typed in the editor since the
// last save is put together from its works; an unknown key is marked.
function fallback(cluster, bib) {
  return cluster.items.map(({ id }) => bib?.singles[id]
    ?? `<span class="citation-key${bib?.ids.includes(id) ? '' : ' citation-key--missing'}" title="${escape(bib ? `@${id} is not in the bibliography` : 'This deck has no bibliography')}">@${escape(id)}${bib?.ids.includes(id) ? '' : '?'}</span>`).join('; ')
}

// Puts each citation's formatted text in place; returns the keys the text
// cites, in order, for the slide's reference footer.
export function renderCitations(markdown, bib = currentBibliography()) {
  if (!markdown || !markdown.includes('@')) return { markdown, ids: [] }
  const known = new Set(bib?.ids ?? [])
  const clusters = scanCitations(markdown, { isKey: id => known.has(id) })
  if (!clusters.length) return { markdown, ids: [] }
  let out = ''
  let at = 0
  const ids = []
  for (const cluster of clusters) {
    const formatted = bib?.clusters[cluster.raw]
    const unknown = cluster.items.filter(item => !known.has(item.id))
    const html = formatted == null ? fallback(cluster, bib) : unknown.length ? `${formatted}; ${fallback({ items: unknown }, bib)}` : formatted
    const keys = cluster.items.map(item => item.id)
    out += markdown.slice(at, cluster.start) + `<cite class="citation" data-cites="${escape(keys.join(' '))}">${html}</cite>`
    at = cluster.end
    for (const id of keys) if (bib?.entries[id] && !ids.includes(id)) ids.push(id)
  }
  return { markdown: out + markdown.slice(at), ids }
}

// The full references of `ids`, for a slide's footer.
export function citationsHtml(ids, bib = currentBibliography()) {
  const entries = ids.map(id => bib?.entries[id]).filter(Boolean)
  return entries.length ? `<div class="csl-bib-body">${entries.join('')}</div>` : ''
}
