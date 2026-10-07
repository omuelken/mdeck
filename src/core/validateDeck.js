import { diagnostic, scanDirectives } from './source.js'
import { isPlainObject, RENAMED_DECK_KEYS } from './parseSlides.js'
import { palettesFor } from '../extensions/tokens.js'
import { LABEL_KEYS, CALLOUT_TYPES } from './labels.js'
import { resolveLayoutProps, propertyErrors } from '../layouts/layoutProps.js'
import { movedHint } from '../extensions/moved.js'

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
  // Colours come only from the palette now.
  for (const key of ['accent', 'accent2']) {
    if (config[key] != null) add('removed-setting', `${key} is no longer a setting: colours come from the palette; choose one with palette (see mdeck list palettes)`, deck.configSource?.start)
  }
  if (config.appearance != null && !['light', 'dark'].includes(config.appearance)) add('invalid-config', 'appearance must be light or dark', deck.configSource?.start)
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
  if (themes && config.theme != null && !Object.hasOwn(themes, config.theme)) add('unknown-theme', movedHint('theme', config.theme) ?? `Unknown theme "${config.theme}"; available: ${Object.keys(themes).join(', ')}`, deck.configSource?.start)
  if (palettes && themes && config.palette != null) {
    const theme = themes[config.theme ?? 'neue']
    const offered = theme ? palettesFor(theme, palettes).map(palette => palette.id) : Object.keys(palettes)
    if (!Object.hasOwn(palettes, config.palette)) add('unknown-palette', movedHint('palette', config.palette) ?? `Unknown palette "${config.palette}"; available: ${offered.join(', ')}`, deck.configSource?.start)
    else if (theme && !offered.includes(config.palette)) add('unknown-palette', `The theme "${theme.id}" does not offer the palette "${config.palette}"; available: ${offered.join(', ')}`, deck.configSource?.start)
  }
  if (themes && config.params != null && isPlainObject(config.params) && Object.hasOwn(themes, config.theme ?? 'neue')) {
    const theme = themes[config.theme ?? 'neue']
    for (const name of Object.keys(config.params)) if (!Object.hasOwn(theme.params ?? {}, name)) add('unknown-param', `Theme "${theme.id}" has no parameter "${name}"; available: ${Object.keys(theme.params ?? {}).join(', ') || 'none'}`, deck.configSource?.start, 'warning')
  }
  // Callout types the deck names under `callouts:` are its own, on purpose.
  const calloutTypes = [...CALLOUT_TYPES, ...(isPlainObject(config.callouts) ? Object.keys(config.callouts).map(key => key.toLowerCase()) : [])]
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
    for (const node of directivesIn(deck.source.slice(slide.source.start, slide.source.end))) {
      if (DIRECTIVES.includes(node.name) || calloutTypes.includes(node.name.toLowerCase())) continue
      const near = closest(node.name.toLowerCase(), [...DIRECTIVES, ...calloutTypes])
      add('unknown-callout', `Unknown block "${node.name}"${near ? `; did you mean "${near}"?` : ''} It shows as a plain callout. Known: ${CALLOUT_TYPES.join(', ')}; name your own under callouts: in the settings`, slide.source.start + node.start, 'warning')
    }
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

// The `:::` blocks mdeck reads itself; any other name is a callout type.
const DIRECTIVES = ['meta', 'notes', 'slot', 'steps', 'columns']

function directivesIn(source) {
  const all = []
  const visit = nodes => { for (const node of nodes) { all.push(node); visit(node.children) } }
  visit(scanDirectives(source).nodes)
  return all
}

// The known name a misspelling is most likely meant to be: at most two
// letters added, left out or changed.
function closest(name, names) {
  const distance = (a, b) => {
    let row = Array.from({ length: b.length + 1 }, (_, i) => i)
    for (let i = 1; i <= a.length; i++) {
      const next = [i]
      for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      row = next
    }
    return row[b.length]
  }
  const [best] = names.map(candidate => [candidate, distance(name, candidate)]).sort((x, y) => x[1] - y[1])
  return best && best[1] <= 2 ? best[0] : null
}

export function formatDiagnostics(diagnostics, filename = 'slides.md') {
  return diagnostics.map(d => `${filename}:${d.line}:${d.column ?? 1}: ${d.severity} [${d.code}] ${d.message}`).join('\n')
}
