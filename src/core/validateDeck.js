import { diagnostic } from './source.js'
import { isPlainObject } from './parseSlides.js'
import { resolveTemplateProps, propertyErrors } from '../templates/templateProps.js'

// `templates`, `themes` and `palettes` are manifest maps from the extension
// registry (see src/extensions/discover.js). Checks for a kind are skipped when
// its map is not supplied.
export function validateDeck(deck, { templates = null, themes = null, palettes = null } = {}) {
  const diagnostics = [...deck.diagnostics]
  const add = (code, message, offset, severity) => diagnostics.push(diagnostic(deck.source, code, message, offset, severity))
  const config = deck.deckConfig
  for (const key of ['width', 'height']) {
    if (config[key] != null && (typeof config[key] !== 'number' || !Number.isFinite(config[key]) || config[key] <= 0)) add('invalid-config', `${key} must be a positive number`, deck.configSource?.start)
  }
  for (const key of ['meta', 'params', 'callouts', 'share', 'live']) {
    if (config[key] != null && !isPlainObject(config[key])) add('invalid-config', `${key} must be a mapping`, deck.configSource?.start)
  }
  if (isPlainObject(config.share)) {
    for (const key of Object.keys(config.share)) if (!['themes', 'notes'].includes(key)) add('invalid-config', `share.${key} is not a setting; available: themes, notes`, deck.configSource?.start, 'warning')
    for (const key of ['themes', 'notes']) if (config.share[key] != null && typeof config.share[key] !== 'boolean') add('invalid-config', `share.${key} must be true or false`, deck.configSource?.start)
  }
  if (config.components != null && (!Array.isArray(config.components) || config.components.some(path => typeof path !== 'string' || !path.trim()))) add('invalid-config', 'components must be a list of folder paths', deck.configSource?.start)
  if (isPlainObject(config.live)) {
    for (const key of Object.keys(config.live)) if (!['server', 'audience', 'id'].includes(key)) add('invalid-config', `live.${key} is not a setting; available: server, audience, id`, deck.configSource?.start, 'warning')
    for (const key of ['server', 'audience']) {
      const value = config.live[key]
      if (value != null && (typeof value !== 'string' || !/^https?:\/\//.test(value))) add('invalid-config', `live.${key} must be an http:// or https:// address`, deck.configSource?.start)
    }
  }
  const enums = { institution: ['title', 'all', 'none'], authorDate: ['title', 'all', 'none'], pageNumbers: ['slides', 'all', 'none'], sections: ['all', 'none'] }
  for (const [key, values] of Object.entries(enums)) {
    if (config[key] != null && !values.includes(config[key])) add('invalid-config', `${key} must be one of: ${values.join(', ')}`, deck.configSource?.start)
  }
  if (themes && config.design != null && !Object.hasOwn(themes, config.design)) add('unknown-theme', `Unknown theme "${config.design}"; available: ${Object.keys(themes).join(', ')}`, deck.configSource?.start)
  if (palettes && config.palette != null && config.palette !== '' && !Object.hasOwn(palettes, config.palette)) add('unknown-palette', `Unknown palette "${config.palette}"; available: ${Object.keys(palettes).join(', ')}`, deck.configSource?.start, 'warning')
  if (themes && config.params != null && isPlainObject(config.params) && Object.hasOwn(themes, config.design ?? 'neue')) {
    const theme = themes[config.design ?? 'neue']
    for (const name of Object.keys(config.params)) if (!Object.hasOwn(theme.params ?? {}, name)) add('unknown-param', `Theme "${theme.id}" has no parameter "${name}"; available: ${Object.keys(theme.params ?? {}).join(', ') || 'none'}`, deck.configSource?.start, 'warning')
  }
  const ids = new Set()
  for (const slide of deck.slides) {
    const offset = slide.metaSource?.start ?? slide.source.start
    if (typeof slide.id !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(slide.id)) add('invalid-id', 'Slide IDs must start with a letter and contain letters, digits, hyphens or underscores', offset)
    if (ids.has(slide.id)) add('duplicate-id', `Duplicate slide ID "${slide.id}"`, offset)
    ids.add(slide.id)
    for (const key of ['layout', 'title', 'image', 'alt', 'section', 'part', 'eyebrow', 'attribution', 'notes', 'note']) {
      if (slide.meta[key] != null && typeof slide.meta[key] !== 'string') add('invalid-metadata', `${key} must be a string`, offset)
    }
    if (slide.meta.props != null && !isPlainObject(slide.meta.props)) add('invalid-props', 'props must be a mapping', offset)
    if (slide.meta.overlay != null && typeof slide.meta.overlay !== 'boolean') add('invalid-metadata', 'overlay must be true or false', offset)
    if (!templates) continue
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
