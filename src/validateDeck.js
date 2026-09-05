import { diagnostic } from './source.js'
import { isPlainObject } from './parseSlides.js'

export const BUILTIN_LAYOUT_NAMES = ['title', 'chapter', 'focus', 'image-text', 'split', 'full-bleed-image', 'generic']

export function validateDeck(deck, { templates } = {}) {
  const diagnostics = [...deck.diagnostics]
  const add = (code, message, offset, severity) => diagnostics.push(diagnostic(deck.source, code, message, offset, severity))
  const config = deck.deckConfig
  for (const key of ['width', 'height']) {
    if (config[key] != null && (typeof config[key] !== 'number' || !Number.isFinite(config[key]) || config[key] <= 0)) add('invalid-config', `${key} must be a positive number`, deck.configSource?.start)
  }
  for (const key of ['meta', 'params', 'callouts']) {
    if (config[key] != null && !isPlainObject(config[key])) add('invalid-config', `${key} must be a mapping`, deck.configSource?.start)
  }
  const ids = new Set()
  for (const slide of deck.slides) {
    const offset = slide.metaSource?.start ?? slide.source.start
    if (typeof slide.id !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(slide.id)) add('invalid-id', 'Slide IDs must start with a letter and contain letters, digits, hyphens or underscores', offset)
    if (ids.has(slide.id)) add('duplicate-id', `Duplicate slide ID "${slide.id}"`, offset)
    ids.add(slide.id)
    for (const key of ['layout', 'image', 'alt', 'section', 'part', 'eyebrow', 'attribution', 'notes', 'note']) {
      if (slide.meta[key] != null && typeof slide.meta[key] !== 'string') add('invalid-metadata', `${key} must be a string`, offset)
    }
    if (slide.meta.props != null && !isPlainObject(slide.meta.props)) add('invalid-props', 'props must be a mapping', offset)
    if (slide.meta.overlay != null && typeof slide.meta.overlay !== 'boolean') add('invalid-metadata', 'overlay must be true or false', offset)
    const layout = slide.meta.layout ?? 'generic'
    if (!(templates ? Object.hasOwn(templates, layout) : BUILTIN_LAYOUT_NAMES.includes(layout))) add('unknown-layout', `Unknown layout "${layout}"; using the generic renderer`, offset, 'warning')
  }
  return diagnostics
}

export function formatDiagnostics(diagnostics, filename = 'slides.md') {
  return diagnostics.map(d => `${filename}:${d.line}:${d.column ?? 1}: ${d.severity} [${d.code}] ${d.message}`).join('\n')
}
