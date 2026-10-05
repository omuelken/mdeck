// The extension manifest contract: one TOML format for layouts, themes and
// palettes. Parsing and validation happen in Node; the normalized result is
// plain data that the runtime, CLI and documentation can all share.
import { existsSync } from 'node:fs'
import { resolve, relative, isAbsolute, sep } from 'node:path'
import { parse as parseToml, TomlError } from 'smol-toml'
import { TOKEN_NAME_RE } from './tokens.js'
import { propertyErrors } from '../layouts/layoutProps.js'

export const SCHEMA_VERSION = 1
export const KINDS = ['layout', 'theme', 'palette']
export const ID_RE = /^[a-z][a-z0-9-]*$/
export const MANIFEST_FILENAME = 'extension.toml'

const FRAMES = ['standard', 'title', 'chapter', 'none']
const PROPERTY_TYPES = ['string', 'number', 'integer', 'boolean', 'array', 'object']
const SHARED_KEYS = ['schema', 'kind', 'id', 'title', 'description']
const KEYS = {
  layout: [...SHARED_KEYS, 'frame', 'files', 'regions', 'properties'],
  theme: [...SHARED_KEYS, 'dark', 'fonts', 'files', 'tokens', 'params', 'accent2', 'accent2Preview'],
  palette: [...SHARED_KEYS, 'dark', 'tokens'],
}
const SCHEMA_KEYS = ['type', 'title', 'description', 'enum', 'required', 'default', 'minimum', 'maximum', 'minItems', 'maxItems', 'items']
const RESERVED_NAMES = ['constructor', 'prototype', '__proto__']

export class ManifestError extends Error {
  constructor(message, { file, path, line, column } = {}) {
    const where = [file, line, line && column].filter(Boolean).join(':')
    super(`${where ? where + ': ' : ''}${path ? path + ': ' : ''}${message}`)
    this.name = 'ManifestError'
    Object.assign(this, { file, path, line, column, reason: message })
  }
}

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)

export function parseManifestText(text, file) {
  try {
    return parseToml(text)
  } catch (error) {
    if (error instanceof TomlError) throw new ManifestError(error.message.split('\n')[0].replace(/^Invalid TOML document: /, ''), { file, line: error.line, column: error.column })
    throw error
  }
}

// Validates a raw manifest object and returns a normalized record:
//   { kind, id, title, description, dir, file, manifest, files }
// `manifest` is serializable public data; `files` holds absolute paths.
export function validateManifest(raw, { file, dir, folderName, fileExists = existsSync } = {}) {
  const fail = (message, path) => { throw new ManifestError(message, { file, path }) }
  if (!isPlainObject(raw)) fail('The manifest must be a table of settings')

  if (raw.schema !== SCHEMA_VERSION) fail(`schema must be ${SCHEMA_VERSION}${raw.schema == null ? ' (add "schema = 1" at the top)' : ''}`, 'schema')
  if (!KINDS.includes(raw.kind)) fail(`kind must be one of: ${KINDS.join(', ')}`, 'kind')
  const kind = raw.kind
  if (raw.name !== undefined) fail('name is not a setting; use id for the identifier and title for the display name', 'name')
  for (const key of Object.keys(raw)) {
    if (!KEYS[kind].includes(key)) fail(`Unknown setting for a ${kind}. Allowed: ${KEYS[kind].join(', ')}`, key)
  }
  if (typeof raw.id !== 'string' || !ID_RE.test(raw.id)) fail('id must use lowercase letters, digits and hyphens and start with a letter', 'id')
  if (folderName != null && raw.id !== folderName) fail(`id "${raw.id}" must match the folder name "${folderName}"`, 'id')
  if (typeof raw.title !== 'string' || !raw.title.trim()) fail('title is required', 'title')
  if (raw.description != null && typeof raw.description !== 'string') fail('description must be text', 'description')

  const files = resolveFiles(raw.files, kind, { dir, fail, fileExists })
  const shared = { id: raw.id, title: raw.title.trim(), description: raw.description?.trim() || '' }
  const manifest = kind === 'layout' ? validateLayout(raw, shared, fail)
    : kind === 'theme' ? validateTheme(raw, shared, fail)
    : validatePalette(raw, shared, fail)
  return { kind, id: raw.id, title: shared.title, description: shared.description, dir, file, manifest, files }
}

const FILE_KEYS = { layout: ['layout', 'styles', 'starter'], theme: ['styles'], palette: [] }
const FILE_DEFAULTS = { layout: { layout: 'layout.jsx', styles: 'styles.css', starter: 'starter.md' }, theme: { styles: 'styles.css' } }

function resolveFiles(section, kind, { dir, fail, fileExists }) {
  if (section != null && !isPlainObject(section)) fail('files must be a table', 'files')
  const declared = section ?? {}
  for (const key of Object.keys(declared)) {
    if (!FILE_KEYS[kind].includes(key)) fail(FILE_KEYS[kind].length ? `Unknown file role for a ${kind}. Allowed: ${FILE_KEYS[kind].join(', ')}` : `A ${kind} has no supporting files`, `files.${key}`)
  }
  const resolveOne = (value, path) => {
    if (typeof value !== 'string' || !value.trim()) fail('must be a file path inside the extension folder', path)
    if (isAbsolute(value)) fail('must be relative to the extension folder', path)
    const abs = resolve(dir ?? '.', value)
    const rel = relative(dir ?? '.', abs)
    if (rel.startsWith('..') || isAbsolute(rel) || rel.split(sep).includes('..')) fail(`"${value}" leaves the extension folder`, path)
    if (!fileExists(abs)) fail(`"${value}" does not exist in ${dir ?? 'the extension folder'}`, path)
    return abs
  }
  const files = {}
  for (const key of FILE_KEYS[kind]) {
    const path = `files.${key}`
    const value = declared[key]
    if (value === undefined) {
      const fallback = FILE_DEFAULTS[kind]?.[key]
      const abs = fallback ? resolve(dir ?? '.', fallback) : null
      if (abs && fileExists(abs)) files[key] = key === 'styles' ? [abs] : abs
      else if (kind === 'layout' && key === 'layout') fail(`layout.jsx is missing; add it or point files.layout at the layout file`, path)
      else files[key] = key === 'styles' ? [] : null
    } else if (key === 'styles') {
      const list = Array.isArray(value) ? value : [value]
      if (!list.length) fail('must name at least one stylesheet or be omitted', path)
      files[key] = list.map((item, index) => resolveOne(item, Array.isArray(value) ? `${path}[${index}]` : path))
    } else files[key] = resolveOne(value, path)
  }
  return files
}

function validateLayout(raw, shared, fail) {
  if (raw.frame != null && !FRAMES.includes(raw.frame)) fail(`frame must be one of: ${FRAMES.join(', ')}`, 'frame')
  if (!isPlainObject(raw.regions) || !Object.hasOwn(raw.regions, 'body')) fail('regions must include a [regions.body] table', 'regions')
  const regions = {}
  for (const [name, region] of Object.entries(raw.regions)) {
    const path = `regions.${name}`
    if (!ID_RE.test(name)) fail('region names use lowercase letters, digits and hyphens', path)
    if (!isPlainObject(region)) fail('must be a table', path)
    for (const key of Object.keys(region)) if (!['description', 'required'].includes(key)) fail('Unknown region setting. Allowed: description, required', `${path}.${key}`)
    if (region.required != null && typeof region.required !== 'boolean') fail('must be true or false', `${path}.required`)
    if (region.description != null && typeof region.description !== 'string') fail('must be text', `${path}.description`)
    regions[name] = { ...(region.description ? { description: region.description } : {}), ...(region.required ? { required: true } : {}) }
  }
  if (raw.properties != null && !isPlainObject(raw.properties)) fail('properties must be a table', 'properties')
  const properties = {}
  for (const [name, schema] of Object.entries(raw.properties ?? {})) {
    const path = `properties.${name}`
    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(name) || RESERVED_NAMES.includes(name)) fail('property names use letters and digits and start with a letter', path)
    properties[name] = validatePropertySchema(schema, path, fail)
  }
  return { ...shared, frame: raw.frame ?? 'standard', regions, properties }
}

function validatePropertySchema(schema, path, fail) {
  if (!isPlainObject(schema)) fail('must be a table with a type', path)
  for (const key of Object.keys(schema)) if (!SCHEMA_KEYS.includes(key)) fail(`Unknown property setting. Allowed: ${SCHEMA_KEYS.join(', ')}`, `${path}.${key}`)
  if (!PROPERTY_TYPES.includes(schema.type)) fail(`type must be one of: ${PROPERTY_TYPES.join(', ')}`, `${path}.type`)
  if (schema.enum != null && (!Array.isArray(schema.enum) || !schema.enum.length)) fail('must be a nonempty list', `${path}.enum`)
  if (schema.required != null && typeof schema.required !== 'boolean') fail('must be true or false', `${path}.required`)
  for (const key of ['title', 'description']) if (schema[key] != null && typeof schema[key] !== 'string') fail('must be text', `${path}.${key}`)
  for (const key of ['minimum', 'maximum', 'minItems', 'maxItems']) {
    if (schema[key] != null && (typeof schema[key] !== 'number' || !Number.isFinite(schema[key]))) fail('must be a number', `${path}.${key}`)
  }
  const normalized = { ...schema }
  if (schema.items !== undefined) normalized.items = validatePropertySchema(schema.items, `${path}.items`, fail)
  if (schema.default !== undefined) {
    const errors = propertyErrors(schema.default, normalized, `${path}.default`)
    if (errors.length) fail(errors.join('; ').replace(new RegExp(`${path.replace(/[.[\]]/g, '\\$&')}\\.default`, 'g'), 'default'), path)
  }
  return normalized
}

function validateTokens(raw, fail) {
  if (!isPlainObject(raw.tokens) || !Object.keys(raw.tokens).length) fail('a [tokens] table with at least one CSS custom property is required', 'tokens')
  const tokens = {}
  for (const [name, value] of Object.entries(raw.tokens)) {
    if (!TOKEN_NAME_RE.test(name)) fail(`token names look like "--accent" (quote them in TOML: "--accent" = "#ff0000")`, `tokens.${name}`)
    if (typeof value !== 'string' || !value.trim()) fail('token values are CSS text', `tokens.${name}`)
    tokens[name] = value.trim()
  }
  return tokens
}

function validateTheme(raw, shared, fail) {
  if (raw.dark != null && typeof raw.dark !== 'boolean') fail('must be true or false', 'dark')
  if (raw.fonts != null && (!Array.isArray(raw.fonts) || raw.fonts.some(url => typeof url !== 'string' || !url.trim()))) fail('must be a list of stylesheet URLs', 'fonts')
  if (raw.accent2 != null && typeof raw.accent2 !== 'boolean') fail('must be true or false', 'accent2')
  if (raw.accent2Preview != null && typeof raw.accent2Preview !== 'string') fail('must be a CSS color', 'accent2Preview')
  const tokens = validateTokens(raw, fail)
  if (raw.params != null && !isPlainObject(raw.params)) fail('params must be a table', 'params')
  const params = {}
  for (const [name, param] of Object.entries(raw.params ?? {})) {
    const path = `params.${name}`
    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(name) || RESERVED_NAMES.includes(name)) fail('parameter names use letters and digits and start with a letter', path)
    if (!isPlainObject(param)) fail('must be a table with a token', path)
    for (const key of Object.keys(param)) if (!['token', 'title', 'description'].includes(key)) fail('Unknown parameter setting. Allowed: token, title, description', `${path}.${key}`)
    if (typeof param.token !== 'string' || !Object.hasOwn(tokens, param.token)) fail(`token must name an entry of [tokens] (got ${JSON.stringify(param.token)})`, `${path}.token`)
    for (const key of ['title', 'description']) if (param[key] != null && typeof param[key] !== 'string') fail('must be text', `${path}.${key}`)
    params[name] = { token: param.token, default: tokens[param.token], ...(param.title ? { title: param.title } : {}), ...(param.description ? { description: param.description } : {}) }
  }
  return {
    ...shared, dark: raw.dark ?? false, fonts: raw.fonts ?? [], tokens, params,
    accent2: raw.accent2 ?? false, ...(raw.accent2Preview ? { accent2Preview: raw.accent2Preview } : {}),
  }
}

function validatePalette(raw, shared, fail) {
  if (raw.dark != null && typeof raw.dark !== 'boolean') fail('must be true or false', 'dark')
  return { ...shared, dark: raw.dark ?? false, tokens: validateTokens(raw, fail) }
}
