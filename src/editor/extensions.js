// Extension editing model: the files of an extension folder are the source of
// truth; forms read a model out of extension.toml and write it back as TOML.
import { parse, stringify } from 'smol-toml'

export const MANIFEST = 'extension.toml'
export const ID_RE = /^[a-z][a-z0-9-]*$/
export { COLOR_ROLES as CORE_TOKENS } from '../extensions/tokens.js'
// Readable colours a new palette starts from.
const STARTER_COLORS = {
  light: { '--bg': '#ffffff', '--surface': '#f2f2f2', '--ink': '#111111', '--ink-soft': '#333333', '--muted': '#666666', '--rule': '#dadada', '--accent': '#0b6bcb', '--accent-2': '#c2410c', '--on-accent': '#ffffff' },
  dark: { '--bg': '#111111', '--surface': '#1e1e1e', '--ink': '#f2f2f2', '--ink-soft': '#cfcfcf', '--muted': '#8f8f8f', '--rule': '#2e2e2e', '--accent': '#6aaeff', '--accent-2': '#fb923c', '--on-accent': '#111111' },
}

const entries = table => Object.entries(table ?? {}).map(([name, value]) => ({ name, ...(value && typeof value === 'object' && !Array.isArray(value) ? value : { value }) }))
const table = (list, pick) => Object.fromEntries(list.filter(item => item.name).map(item => [item.name, pick(item)]))
const clean = object => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined && value !== '' && value !== null && !(Array.isArray(value) && !value.length)))

export function parseManifest(text) {
  try { return { raw: parse(text) } } catch (error) { return { error: error.message.replace(/^Invalid TOML document: /, ''), line: error.line, column: error.column } }
}

// Raw TOML object → editable model. Unknown fields are kept in `extra`.
export function toModel(raw) {
  // `starter`, `source` and `file` come from registry listings, not manifests.
  const { schema, kind, id, title, description, theme, light, dark, palette, palettes, appearance, fonts, files, tokens, params, frame, regions, properties, starter, source, file, ...extra } = raw
  const model = { kind, id: id ?? '', title: title ?? '', description: description ?? '', extra, files: files ?? {} }
  // A palette: its light and dark colours, and the theme it belongs to, if any.
  if (kind === 'palette') return { ...model, theme: theme ?? '', light: entries(light), dark: entries(dark) }
  if (kind === 'theme') return { ...model, palette: palette ?? '', palettes: palettes ?? [], appearance: appearance ?? 'light', fonts: fonts ?? [], tokens: entries(tokens), params: entries(params) }
  if (kind === 'layout') return { ...model, frame: frame ?? 'standard', regions: entries(regions), properties: entries(properties).map(property => ({ ...property, enum: property.enum ?? [], items: property.items ?? null })) }
  return model
}

export function toToml(model) {
  const base = { schema: 1, kind: model.kind, id: model.id, title: model.title, ...clean({ description: model.description }) }
  const tokens = table(model.tokens ?? [], token => token.value ?? '')
  let raw
  if (model.kind === 'palette') raw = { ...base, ...clean({ theme: model.theme }), ...model.extra, light: table(model.light ?? [], token => token.value ?? ''), dark: table(model.dark ?? [], token => token.value ?? '') }
  else if (model.kind === 'theme') raw = {
    ...base, palette: model.palette, ...clean({ palettes: model.palettes }), ...(model.appearance === 'dark' ? { appearance: 'dark' } : {}), fonts: model.fonts ?? [], ...model.extra,
    files: { styles: 'styles.css', ...(model.files ?? {}) }, tokens,
    params: table(model.params ?? [], param => clean({ token: param.token, title: param.title, description: param.description })),
  }
  else if (model.kind === 'layout') raw = {
    ...base, ...(model.frame && model.frame !== 'standard' ? { frame: model.frame } : {}), ...model.extra, ...(Object.keys(model.files ?? {}).length ? { files: model.files } : {}),
    regions: table(model.regions ?? [], region => clean({ description: region.description, required: region.required || undefined })),
    properties: table(model.properties ?? [], property => propertySchema(property)),
  }
  else raw = { ...base, ...model.extra }
  if (raw.params && !Object.keys(raw.params).length) delete raw.params
  if (raw.properties && !Object.keys(raw.properties).length) delete raw.properties
  return stringify(raw) + '\n'
}

function propertySchema(property) {
  const schema = clean({ type: property.type ?? 'string', title: property.title, description: property.description, required: property.required || undefined,
    enum: property.enum?.length ? property.enum : undefined, minimum: property.minimum, maximum: property.maximum, minItems: property.minItems, maxItems: property.maxItems })
  if (property.default !== undefined && property.default !== null) schema.default = property.default
  if (property.items && property.type === 'array') schema.items = clean({ type: property.items.type ?? 'string', minimum: property.items.minimum, maximum: property.items.maximum, enum: property.items.enum?.length ? property.items.enum : undefined })
  return schema
}

// Manifest as the runtime expects it, for live previews of unsaved work.
export function toRuntimeManifest(model) {
  const tokens = table(model.tokens ?? [], token => token.value ?? '')
  const shared = { id: model.id, title: model.title, description: model.description ?? '' }
  if (model.kind === 'palette') return { ...shared, ...(model.theme ? { theme: model.theme } : {}), light: table(model.light ?? [], token => token.value ?? ''), dark: table(model.dark ?? [], token => token.value ?? '') }
  if (model.kind === 'theme') return {
    ...shared, palette: model.palette, ...(model.palettes?.length ? { palettes: model.palettes } : {}), appearance: model.appearance ?? 'light', fonts: model.fonts ?? [], tokens,
    params: table(model.params ?? [], param => ({ token: param.token, default: tokens[param.token] ?? '', ...(param.title ? { title: param.title } : {}) })),
    ...(model.extra?.guide ? { guide: runtimeGuide(model.extra.guide) } : {}),
  }
  return shared
}

// A theme's guide as validateManifest normalizes it (the forms do not edit it;
// it is kept with the other settings they do not know).
function runtimeGuide(guide) {
  const phrases = list => list?.map(phrase => String(phrase).trim())
  return clean({ suits: phrases(guide.suits), avoid: phrases(guide.avoid), writing: guide.writing?.trim().replace(/[ \t]+\n/g, '\n') })
}

// Starting points for new extensions. `from` is a registry manifest to copy;
// a theme is always a copy, a palette may start from readable plain colours.
export function starterFiles(kind, id, title, from = null, fromFiles = {}) {
  if (kind === 'palette') {
    const light = from?.light ? entries(from.light) : entries(STARTER_COLORS.light)
    const dark = from?.dark ? entries(from.dark) : entries(STARTER_COLORS.dark)
    return { [MANIFEST]: toToml({ kind, id, title, description: '', theme: '', light, dark, extra: {} }) }
  }
  if (kind !== 'theme' || !from) throw new Error('A new theme starts as a copy of another one')
  const params = from.params && Object.fromEntries(Object.entries(from.params).map(([name, param]) => [name, { token: param.token, title: param.title, description: param.description }]))
  return { [MANIFEST]: toToml({ ...toModel({ ...from, kind, params }), id, title, files: {} }), 'styles.css': fromFiles['styles.css'] ?? '' }
}
