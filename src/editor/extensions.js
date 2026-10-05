// Extension editing model: the files of an extension folder are the source of
// truth; forms read a model out of extension.toml and write it back as TOML.
import { parse, stringify } from 'smol-toml'

export const MANIFEST = 'extension.toml'
export const ID_RE = /^[a-z][a-z0-9-]*$/
export const CORE_TOKENS = ['--bg', '--surface', '--ink', '--ink-soft', '--muted', '--rule', '--accent', '--accent-2', '--on-accent']
export const PROPERTY_TYPES = ['string', 'number', 'integer', 'boolean', 'array', 'object']
export const FRAMES = ['standard', 'title', 'chapter', 'none']

const entries = table => Object.entries(table ?? {}).map(([name, value]) => ({ name, ...(value && typeof value === 'object' && !Array.isArray(value) ? value : { value }) }))
const table = (list, pick) => Object.fromEntries(list.filter(item => item.name).map(item => [item.name, pick(item)]))
const clean = object => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined && value !== '' && value !== null && !(Array.isArray(value) && !value.length)))

export function parseManifest(text) {
  try { return { raw: parse(text) } } catch (error) { return { error: error.message.replace(/^Invalid TOML document: /, ''), line: error.line, column: error.column } }
}

// Raw TOML object → editable model. Unknown fields are kept in `extra`.
export function toModel(raw) {
  // `starter`, `source` and `file` come from registry listings, not manifests.
  const { schema, kind, id, title, description, dark, accent2, accent2Preview, fonts, files, tokens, params, frame, regions, properties, starter, source, file, ...extra } = raw
  const model = { kind, id: id ?? '', title: title ?? '', description: description ?? '', extra, files: files ?? {} }
  if (kind === 'palette') return { ...model, dark: Boolean(dark), tokens: entries(tokens) }
  if (kind === 'theme') return { ...model, dark: Boolean(dark), accent2: Boolean(accent2), accent2Preview: accent2Preview ?? '', fonts: fonts ?? [], tokens: entries(tokens), params: entries(params) }
  if (kind === 'layout') return { ...model, frame: frame ?? 'standard', regions: entries(regions), properties: entries(properties).map(property => ({ ...property, enum: property.enum ?? [], items: property.items ?? null })) }
  return model
}

export function toToml(model) {
  const base = { schema: 1, kind: model.kind, id: model.id, title: model.title, ...clean({ description: model.description }) }
  const tokens = table(model.tokens ?? [], token => token.value ?? '')
  let raw
  if (model.kind === 'palette') raw = { ...base, ...(model.dark ? { dark: true } : {}), ...model.extra, tokens }
  else if (model.kind === 'theme') raw = {
    ...base, ...(model.dark ? { dark: true } : {}), ...(model.accent2 ? { accent2: true } : {}), ...clean({ accent2Preview: model.accent2Preview }), fonts: model.fonts ?? [], ...model.extra,
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
  if (model.kind === 'palette') return { ...shared, dark: Boolean(model.dark), tokens }
  if (model.kind === 'theme') return {
    ...shared, dark: Boolean(model.dark), fonts: model.fonts ?? [], tokens, accent2: Boolean(model.accent2), ...(model.accent2Preview ? { accent2Preview: model.accent2Preview } : {}),
    params: table(model.params ?? [], param => ({ token: param.token, default: tokens[param.token] ?? '', ...(param.title ? { title: param.title } : {}) })),
  }
  return shared
}

// Starting points for new extensions. `from` is a registry manifest to copy.
export function starterFiles(kind, id, title, from = null, fromFiles = {}) {
  if (kind === 'palette') {
    const tokens = from?.tokens ? entries(from.tokens) : CORE_TOKENS.map(name => ({ name, value: '#888888' }))
    return { [MANIFEST]: toToml({ kind, id, title, description: '', dark: Boolean(from?.dark), tokens, extra: {} }) }
  }
  if (kind === 'theme') {
    const model = from ? { ...toModel({ ...from, kind, params: from.params && Object.fromEntries(Object.entries(from.params).map(([name, param]) => [name, { token: param.token, title: param.title, description: param.description }])) }), id, title, files: {} }
      : { kind, id, title, description: '', dark: false, accent2: false, accent2Preview: '', fonts: [], tokens: [...CORE_TOKENS.map(name => ({ name, value: name === '--bg' ? '#ffffff' : name.includes('ink') ? '#111111' : '#888888' })), { name: '--font-display', value: 'system-ui, sans-serif' }, { name: '--font-body', value: 'system-ui, sans-serif' }], params: [{ name: 'primaryColor', token: '--accent', title: 'Primary color' }], extra: {}, files: {} }
    return { [MANIFEST]: toToml(model), 'styles.css': fromFiles['styles.css'] ?? DEFAULT_THEME_CSS }
  }
  const model = from ? { ...toModel({ ...from, kind }), id, title, files: {} } : { kind, id, title, description: '', frame: 'standard', regions: [{ name: 'body', description: 'Main content' }], properties: [], extra: {}, files: {} }
  return {
    [MANIFEST]: toToml(model),
    'layout.jsx': fromFiles['layout.jsx'] ?? DEFAULT_LAYOUT,
    'styles.css': fromFiles['styles.css'] ?? `.slide--${id} .slide-body { gap: 32px; }\n`,
    'starter.md': fromFiles['starter.md']?.replace(/^layout: .*$/m, `layout: ${id}`) ?? `:::meta\nlayout: ${id}\n:::\n# ${title}\n\nYour content here.\n`,
  }
}

export const DEFAULT_LAYOUT = `import { h } from 'preact'
import { MarkdownRegion } from 'mdeck/layout'

// Receives regions, props (typed settings), meta, deckConfig, index and total.
export default function Layout({ regions, props }) {
  return <div class="slide-body">
    <MarkdownRegion region={regions.body} />
  </div>
}
`

export const DEFAULT_THEME_CSS = `/* Slide frame and layout rules. Token defaults live in extension.toml. */
.slide { background: var(--bg); color: var(--ink); font-family: var(--font-body); font-size: var(--fs-body, 34px); }
.slide-body { padding: var(--pad-y, 72px) var(--pad-x, 120px); display: flex; flex-direction: column; gap: 24px; }
.slide h1, .slide h2 { font-family: var(--font-display); color: var(--ink); margin: 0; }
.slide h1 { font-size: var(--fs-title, 88px); }
.slide h2 { font-size: var(--fs-h, 64px); }
.slide em { color: var(--accent); font-style: normal; }
.slide-header, .slide-footer { display: flex; justify-content: space-between; padding: 24px var(--pad-x, 120px); color: var(--muted); font-size: var(--fs-small, 24px); }
`

export function deckHeader(deck) {
  if (!deck.configSource) return ''
  const end = deck.source.indexOf('\n', deck.configSource.end)
  return deck.source.slice(0, end < 0 ? deck.source.length : end + 1)
}
