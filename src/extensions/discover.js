// One discovery layer for layouts, themes and palettes. The same registry
// backs `mdeck check`, CLI listings, the dev server and builds.
import { palettesFor } from './tokens.js'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { resolve, dirname, relative } from 'node:path'
import { homedir } from 'node:os'
import { MANIFEST_FILENAME, ManifestError, KINDS, parseManifestText, validateManifest } from './manifest.js'
import { builtinExtensionsRoot } from '../paths.js'

const SKIP = name => name.startsWith('.') || name === 'node_modules'

// mdeck's own folder for this user: ~/.mdeck, or $MDECK_HOME.
export function mdeckHome() {
  return process.env.MDECK_HOME || resolve(homedir(), '.mdeck')
}

// Extensions installed for one user (`mdeck themes install --global`), for
// every deck: ~/.mdeck/extensions.
export function userExtensionsDir() {
  return resolve(mdeckHome(), 'extensions')
}

// The built-in themes and palettes this user removed (`mdeck themes remove
// glass`): they stay in mdeck's folder but are not offered. Kept as
// "theme:glass" and "palette:nordic".
const removedFile = () => resolve(mdeckHome(), 'removed.json')
export function removedBuiltIns() {
  let saved = {}
  try { saved = JSON.parse(readFileSync(removedFile(), 'utf8')) } catch {}
  return (Array.isArray(saved.hidden) ? saved.hidden : []).filter(key => /^(theme|palette):[a-z][a-z0-9-]*$/.test(key))
}
export function setRemovedBuiltIns(keys) {
  mkdirSync(mdeckHome(), { recursive: true })
  writeFileSync(removedFile(), JSON.stringify({ hidden: [...new Set(keys)].sort() }, null, 2) + '\n')
}

// mdeck's own layouts, themes and palettes, then the user's, then the deck's
// own. For themes and palettes a later place replaces an earlier one with the
// same id: an installed newer version replaces the built-in one, and a
// deck's copy replaces both. Built-in themes and palettes this user removed
// are left out. `userRoot: null` leaves out what this user installed and
// removed, for results that must not depend on the computer (checks, the
// repository).
export function extensionRoots(slidesPath, { builtinRoot = builtinExtensionsRoot, userRoot = userExtensionsDir() } = {}) {
  const deckDir = dirname(resolve(slidesPath))
  return [
    { dir: builtinRoot, source: 'built-in', hidden: userRoot ? removedBuiltIns() : [] },
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
  const RANK = { 'built-in': 0, user: 1, local: 2 }
  const add = (record, source) => {
    const key = `${record.kind}:${record.id}`
    const existing = byKey.get(key)
    const entry = { ...record, source }
    // Themes and palettes may be replaced from a later place; layouts and two
    // with one id in the same place may not.
    const replaces = existing && record.kind !== 'layout' && RANK[source] > RANK[existing.source]
    if (replaces) {
      if (existing.source === 'user') registry.warnings.push(`The ${record.kind} "${record.id}" in this deck's extensions replaces the one installed in ${dirname(existing.dir)}`)
      registry.records.splice(registry.records.indexOf(existing), 1)
    } else if (existing) throw new ManifestError(`Duplicate ${record.kind} "${record.id}" is also defined in ${existing.file}. Extension IDs must be unique within their kind.`, { file: record.file })
    byKey.set(key, entry)
    registry.records.push(entry)
    registry[`${record.kind}s`][record.id] = entry
  }
  for (const root of roots) {
    if (!existsSync(root.dir) || !statSync(root.dir).isDirectory()) continue
    for (const found of walk(root.dir)) {
      const record = loadManifest(found)
      if (!root.hidden?.includes(`${record.kind}:${record.id}`)) add(record, root.source)
    }
  }
  // Themes and palettes in name order, wherever they come from.
  for (const kind of ['themes', 'palettes']) registry[kind] = Object.fromEntries(Object.entries(registry[kind]).sort(([a], [b]) => a.localeCompare(b, 'en')))
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

// The extensions that come with mdeck, alone, removed or not.
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
      ...record.manifest, kind, source: record.source, ...(record.package?.version ? { version: record.package.version } : {}),
      file: relativeTo ? relative(relativeTo, record.file) : record.file,
    }))
  }
  return out
}
