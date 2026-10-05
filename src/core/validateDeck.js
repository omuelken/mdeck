import { diagnostic } from './source.js'
import { isPlainObject, RENAMED_DECK_KEYS } from './parseSlides.js'
import { LABEL_KEYS } from './labels.js'
import { resolveLayoutProps, propertyErrors } from '../layouts/layoutProps.js'

// `layouts`, `themes` and `palettes` are manifest maps from the extension
// registry (see src/extensions/discover.js). Checks for a kind are skipped when
// its map is not supplied.
export function validateDeck(deck, { layouts = null, themes = null, palettes = null } = {}) {
  const diagnostics = [...deck.diagnostics]
  const add = (code, message, offset, severity) => diagnostics.push(diagnostic(deck.source, code, message, offset, severity))
  const config = deck.deckConfig
  for (const key of ['width', 'height']) {
    if (config[key] != null && (typeof config[key] !== 'number' || !Number.isFinite(config[key]) || config[key] <= 0)) add('invalid-config', `${key} must be a positive number`, deck.configSource?.start)
  }
  for (const [old, now] of Object.entries(RENAMED_DECK_KEYS)) {
    if (config[old] != null) add('renamed-setting', `${old} is now ${now}${old === 'live' ? ': the address is server, and id and code are session.id and session.code' : ''}`, deck.configSource?.start)
  }
  for (const key of ['meta', 'params', 'callouts', 'labels', 'show', 'reader', 'session']) {
    if (config[key] != null && !isPlainObject(config[key])) add('invalid-config', `${key} must be a mapping`, deck.configSource?.start)
  }
  if (isPlainObject(config.reader)) {
    for (const key of Object.keys(config.reader)) if (!['themes', 'notes'].includes(key)) add('invalid-config', `reader.${key} is not a setting; available: themes, notes`, deck.configSource?.start, 'warning')
    for (const key of ['themes', 'notes']) if (config.reader[key] != null && typeof config.reader[key] !== 'boolean') add('invalid-config', `reader.${key} must be true or false`, deck.configSource?.start)
  }
  if (config.components != null && (!Array.isArray(config.components) || config.components.some(path => typeof path !== 'string' || !path.trim()))) add('invalid-config', 'components must be a list of folder paths', deck.configSource?.start)
  if (config.lang != null && (typeof config.lang !== 'string' || !/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(config.lang))) add('invalid-config', 'lang must be a language code such as en, de or de-CH', deck.configSource?.start)
  if (isPlainObject(config.labels)) {
    for (const [key, value] of Object.entries(config.labels)) {
      if (!LABEL_KEYS.includes(key)) add('invalid-config', `labels.${key} is not a label; see the authoring reference for the list`, deck.configSource?.start, 'warning')
      else if (typeof value !== 'string') add('invalid-config', `labels.${key} must be text`, deck.configSource?.start)
    }
  }
  if (config.server != null && (typeof config.server !== 'string' || !/^https?:\/\//.test(config.server))) add('invalid-config', 'server must be an http:// or https:// address', deck.configSource?.start)
  if (isPlainObject(config.session)) {
    for (const key of Object.keys(config.session)) if (!['id', 'code'].includes(key)) add('invalid-config', `session.${key} is not a setting; available: id, code`, deck.configSource?.start, 'warning')
    if (config.session.code != null && !/^\d{4,8}$/.test(String(config.session.code))) add('invalid-config', 'session.code must be 4 to 8 digits', deck.configSource?.start)
  }
  const enums = { organization: ['title', 'all', 'none'], author: ['title', 'all', 'none'], numbers: ['slides', 'all', 'none'], sections: ['all', 'none'] }
  if (isPlainObject(config.show)) {
    for (const key of Object.keys(config.show)) if (!Object.hasOwn(enums, key)) add('invalid-config', `show.${key} is not a setting; available: ${Object.keys(enums).join(', ')}`, deck.configSource?.start, 'warning')
    for (const [key, values] of Object.entries(enums)) {
      if (config.show[key] != null && !values.includes(config.show[key])) add('invalid-config', `show.${key} must be one of: ${values.join(', ')}`, deck.configSource?.start)
    }
  }
  if (themes && config.theme != null && !Object.hasOwn(themes, config.theme)) add('unknown-theme', `Unknown theme "${config.theme}"; available: ${Object.keys(themes).join(', ')}`, deck.configSource?.start)
  if (palettes && config.palette != null && config.palette !== '' && !Object.hasOwn(palettes, config.palette)) add('unknown-palette', `Unknown palette "${config.palette}"; available: ${Object.keys(palettes).join(', ')}`, deck.configSource?.start, 'warning')
  if (themes && config.params != null && isPlainObject(config.params) && Object.hasOwn(themes, config.theme ?? 'neue')) {
    const theme = themes[config.theme ?? 'neue']
    for (const name of Object.keys(config.params)) if (!Object.hasOwn(theme.params ?? {}, name)) add('unknown-param', `Theme "${theme.id}" has no parameter "${name}"; available: ${Object.keys(theme.params ?? {}).join(', ') || 'none'}`, deck.configSource?.start, 'warning')
  }
  const ids = new Set()
  for (const slide of deck.slides) {
    const offset = slide.metaSource?.start ?? slide.source.start
    if (typeof slide.id !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(slide.id)) add('invalid-id', 'Slide IDs must start with a letter and contain letters, digits, hyphens or underscores', offset)
    if (ids.has(slide.id)) add('duplicate-id', `Duplicate slide ID "${slide.id}"`, offset)
    ids.add(slide.id)
    for (const key of ['note', 'notes']) {
      if (Object.hasOwn(slide.authoredMeta, key)) add('invalid-metadata', `${key} is not a slide setting; write speaker notes in a :::notes block`, offset)
    }
    for (const key of ['layout', 'title', 'image', 'alt', 'section', 'part', 'eyebrow', 'attribution']) {
      if (slide.meta[key] != null && typeof slide.meta[key] !== 'string') add('invalid-metadata', `${key} must be a string`, offset)
    }
    if (slide.meta.props != null && !isPlainObject(slide.meta.props)) add('invalid-props', 'props must be a mapping', offset)
    if (slide.meta.overlay != null && typeof slide.meta.overlay !== 'boolean') add('invalid-metadata', 'overlay must be true or false', offset)
    if (!layouts) continue
    const layout = slide.meta.layout ?? 'generic'
    if (!Object.hasOwn(layouts, layout)) {
      add('unknown-layout', `Unknown layout "${layout}"; using the generic renderer`, offset, 'warning')
      continue
    }
    const manifest = layouts[layout]
    for (const [name, region] of Object.entries(slide.regions)) {
      if (region.explicit && !Object.hasOwn(manifest.regions, name)) add('unknown-region', `Layout "${layout}" has no region "${name}"`, region.source.start)
    }
    for (const [name, schema] of Object.entries(manifest.regions)) {
      if (schema.required && !slide.regions[name]?.content.trim()) add('missing-region', `Layout "${layout}" requires region "${name}"`, offset)
    }
    if (slide.meta.props != null && !isPlainObject(slide.meta.props)) continue
    const props = resolveLayoutProps(manifest, slide.meta)
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
