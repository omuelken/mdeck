import { diagnostic } from './source.js'
import { isPlainObject } from './parseSlides.js'
import { builtinManifests, resolveTemplateProps, propertyErrors } from '../templates/templateManifests.js'

export function validateDeck(deck, { templates = builtinManifests } = {}) {
  const diagnostics = [...deck.diagnostics]
  const add = (code, message, offset, severity) => diagnostics.push(diagnostic(deck.source, code, message, offset, severity))
  const config = deck.deckConfig
  for (const key of ['width', 'height']) {
    if (config[key] != null && (typeof config[key] !== 'number' || !Number.isFinite(config[key]) || config[key] <= 0)) add('invalid-config', `${key} must be a positive number`, deck.configSource?.start)
  }
  for (const key of ['meta', 'params', 'callouts']) {
    if (config[key] != null && !isPlainObject(config[key])) add('invalid-config', `${key} must be a mapping`, deck.configSource?.start)
  }
  const enums = { institution: ['title', 'all', 'none'], authorDate: ['title', 'all', 'none'], pageNumbers: ['slides', 'all', 'none'], sections: ['all', 'none'] }
  for (const [key, values] of Object.entries(enums)) {
    if (config[key] != null && !values.includes(config[key])) add('invalid-config', `${key} must be one of: ${values.join(', ')}`, deck.configSource?.start)
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
    if (!Object.hasOwn(templates, layout)) {
      add('unknown-layout', `Unknown layout "${layout}"; using the generic renderer`, offset, 'warning')
      continue
    }
    const manifest = templates[layout]
    for (const [name, region] of Object.entries(slide.regions)) {
      if (region.explicit && !Object.hasOwn(manifest.regions, name)) add('unknown-region', `Layout "${layout}" has no region "${name}"`, region.source.start)
    }
    for (const [name, schema] of Object.entries(manifest.regions)) {
      if (schema.required && !slide.regions[name]?.content.trim()) add('missing-region', `Layout "${layout}" requires region "${name}"`, offset)
    }
    if (slide.meta.props != null && !isPlainObject(slide.meta.props)) continue
    const props = resolveTemplateProps(manifest, slide.meta)
    for (const [name, schema] of Object.entries(manifest.properties ?? {})) {
      if (props[name] === undefined) {
        if (schema.required) add('missing-property', `Layout "${layout}" requires props.${name}`, offset)
      } else for (const message of propertyErrors(props[name], schema, `props.${name}`)) add('invalid-property', message, offset)
    }
    for (const name of Object.keys(slide.meta.props ?? {})) {
      if (!Object.hasOwn(manifest.properties ?? {}, name)) add('unknown-property', `Layout "${layout}" has no property "${name}"`, offset)
    }
  }
  return diagnostics
}

export function formatDiagnostics(diagnostics, filename = 'slides.md') {
  return diagnostics.map(d => `${filename}:${d.line}:${d.column ?? 1}: ${d.severity} [${d.code}] ${d.message}`).join('\n')
}
