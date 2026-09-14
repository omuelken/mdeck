// Read-only helpers that derive editor views from the parsed deck and the
// extension manifests.
import { marked } from 'marked'
export { slideTitle } from '../core/outline.js'

// Body first, then the manifest's regions in order, then explicit regions the
// manifest does not know about.
export function regionsFor(slide, manifest) {
  const declared = manifest?.regions ?? { body: {} }
  const names = ['body', ...Object.keys(declared).filter(name => name !== 'body')]
  const known = new Set(names)
  const list = names.map(name => ({
    name, description: declared[name]?.description ?? '', required: Boolean(declared[name]?.required),
    present: Boolean(slide.regions[name]), content: slide.regions[name]?.content ?? '', unknown: false,
  }))
  for (const name of Object.keys(slide.regions)) {
    if (!known.has(name)) list.push({ name, description: '', required: false, present: true, content: slide.regions[name].content, unknown: true })
  }
  return list
}

// Where an authored property value lives: under props, as a legacy top-level
// key (built-in layouts accept image:, alt:, fit:, position:, overlay:), or nowhere.
export function propSource(authoredMeta = {}, key) {
  if (authoredMeta.props && Object.hasOwn(authoredMeta.props, key)) return 'props'
  if (Object.hasOwn(authoredMeta, key) && key !== 'props') return 'legacy'
  return null
}

export function slideDiagnostics(diagnostics, slide) {
  return diagnostics.filter(d => d.offset >= slide.source.start && d.offset < Math.max(slide.source.end, slide.source.start + 1))
}

export function deckDiagnostics(diagnostics, deck) {
  return diagnostics.filter(d => !deck.slides.some(slide => d.offset >= slide.source.start && d.offset < Math.max(slide.source.end, slide.source.start + 1)))
}

export { marked }
