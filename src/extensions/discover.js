// One discovery layer for layouts, themes and palettes. The same registry
// backs `mdeck check`, CLI listings, the dev server and builds.
import { palettesFor } from './tokens.js'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve, dirname, relative } from 'node:path'
import { homedir } from 'node:os'
import { MANIFEST_FILENAME, ManifestError, KINDS, parseManifestText, validateManifest } from './manifest.js'
import { builtinExtensionsRoot } from '../paths.js'

const SKIP = name => name.startsWith('.') || name === 'node_modules'

// Extensions installed for one user (`mdeck themes install --global`), for
// every deck: ~/.mdeck/extensions, or $MDECK_HOME/extensions.
export function userExtensionsDir() {
  return resolve(process.env.MDECK_HOME || resolve(homedir(), '.mdeck'), 'extensions')
}

// Built-in, then the user's, then the deck's own: a deck's extension replaces
// a user one with the same id.
export function extensionRoots(slidesPath, { builtinRoot = builtinExtensionsRoot, userRoot = userExtensionsDir() } = {}) {
  const deckDir = dirname(resolve(slidesPath))
  return [
    { dir: builtinRoot, source: 'built-in' },
    ...(userRoot ? [{ dir: userRoot, source: 'user' }] : []),
    { dir: resolve(deckDir, 'extensions'), source: 'local' },
  ]
}

function sortedEntries(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !SKIP(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))
}

// A folder holding extension.toml is an extension; any other folder is a
// grouping folder and is searched further. Folder names must equal the id.
function* walk(dir) {
  for (const entry of sortedEntries(dir)) {
    const sub = resolve(dir, entry.name)
    const file = resolve(sub, MANIFEST_FILENAME)
    if (existsSync(file)) yield { dir: sub, file, folderName: entry.name }
    else yield* walk(sub)
  }
}

function readLayout(record) {
  const starter = record.files.starter ? readFileSync(record.files.starter, 'utf8') : `:::meta\nlayout: ${record.id}\n:::\n`
  return { ...record, manifest: { ...record.manifest, starter } }
}

function loadManifest({ dir, file, folderName }) {
  const raw = parseManifestText(readFileSync(file, 'utf8'), file)
  const record = validateManifest(raw, { file, dir, folderName })
  return record.kind === 'layout' ? readLayout(record) : record
}

export function discoverExtensions(roots) {
  const registry = { layouts: {}, themes: {}, palettes: {}, records: [], warnings: [] }
  const byKey = new Map()
  const add = (record, source) => {
    const key = `${record.kind}:${record.id}`
    const existing = byKey.get(key)
    const entry = { ...record, source }
    if (existing?.source === 'user' && source === 'local') {
      registry.warnings.push(`The ${record.kind} "${record.id}" in this deck's extensions replaces the one installed in ${dirname(existing.dir)}`)
      registry.records.splice(registry.records.indexOf(existing), 1)
    } else if (existing) throw new ManifestError(`Duplicate ${record.kind} "${record.id}" is also defined in ${existing.file}. Extension IDs must be unique within their kind.`, { file: record.file })
    byKey.set(key, entry)
    registry.records.push(entry)
    registry[`${record.kind}s`][record.id] = entry
  }
  for (const root of roots) {
    if (!existsSync(root.dir) || !statSync(root.dir).isDirectory()) continue
    for (const found of walk(root.dir)) add(loadManifest(found), root.source)
  }
  checkPaletteReferences(registry)
  return registry
}

// Themes and palettes name each other across files: a theme's default palette
// and its list must exist and fit it, a private palette's theme must exist.
function checkPaletteReferences(registry) {
  for (const theme of Object.values(registry.themes)) {
    const offered = palettesFor(theme.manifest, manifestsOf(registry, 'palette'))
    for (const id of theme.manifest.palettes ?? []) {
      if (!registry.palettes[id]) throw new ManifestError(`palettes names "${id}", which is not a palette. Available: ${Object.keys(registry.palettes).join(', ')}`, { file: theme.file, path: 'palettes' })
      const owner = registry.palettes[id].manifest.theme
      if (owner && owner !== theme.id) throw new ManifestError(`palette "${id}" belongs to the theme "${owner}"`, { file: theme.file, path: 'palettes' })
    }
    if (!registry.palettes[theme.manifest.palette]) throw new ManifestError(`palette "${theme.manifest.palette}" does not exist. Available: ${Object.keys(registry.palettes).join(', ')}`, { file: theme.file, path: 'palette' })
    if (!offered.some(palette => palette.id === theme.manifest.palette)) throw new ManifestError(`palette "${theme.manifest.palette}" belongs to another theme`, { file: theme.file, path: 'palette' })
  }
  for (const palette of Object.values(registry.palettes)) {
    const owner = palette.manifest.theme
    if (owner && !registry.themes[owner]) throw new ManifestError(`theme "${owner}" does not exist, so nothing could use this palette`, { file: palette.file, path: 'theme' })
  }
}

// The extensions that come with mdeck, alone.
export function builtInRegistry() {
  return discoverExtensions([{ dir: builtinExtensionsRoot, source: 'built-in' }])
}

export function loadRegistry(slidesPath, options) {
  return discoverExtensions(extensionRoots(slidesPath, options))
}

export function manifestsOf(registry, kind) {
  return Object.fromEntries(Object.entries(registry[`${kind}s`]).map(([id, record]) => [id, record.manifest]))
}

export function layoutManifests(slidesPath, options) {
  return manifestsOf(loadRegistry(slidesPath, options), 'layout')
}

// Serializable listing for `mdeck list --json` and future editors.
export function serializeRegistry(registry, { relativeTo } = {}) {
  const out = { schema: 2, warnings: registry.warnings }
  for (const kind of KINDS) {
    out[`${kind}s`] = Object.values(registry[`${kind}s`]).map(record => ({
      ...record.manifest, kind, source: record.source,
      file: relativeTo ? relative(relativeTo, record.file) : record.file,
    }))
  }
  return out
}
