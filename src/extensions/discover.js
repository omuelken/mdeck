// One discovery layer for layouts, themes and palettes. The same registry
// backs `mdeck check`, CLI listings, the dev server and builds.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve, dirname, relative } from 'node:path'
import { MANIFEST_FILENAME, ManifestError, KINDS, parseManifestText, validateManifest } from './manifest.js'
import { builtinExtensionsRoot } from '../paths.js'

const SKIP = name => name.startsWith('.') || name === 'node_modules'

export function extensionRoots(slidesPath, { builtinRoot = builtinExtensionsRoot } = {}) {
  const deckDir = dirname(resolve(slidesPath))
  return [
    { dir: builtinRoot, source: 'built-in' },
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
    if (existing) throw new ManifestError(`Duplicate ${record.kind} "${record.id}" is also defined in ${existing.file}. Extension IDs must be unique within their kind.`, { file: record.file })
    const entry = { ...record, source }
    byKey.set(key, entry)
    registry.records.push(entry)
    registry[`${record.kind}s`][record.id] = entry
  }
  for (const root of roots) {
    if (!existsSync(root.dir) || !statSync(root.dir).isDirectory()) continue
    for (const found of walk(root.dir)) add(loadManifest(found), root.source)
  }
  return registry
}

export function loadRegistry(slidesPath, options) {
  return discoverExtensions(extensionRoots(slidesPath, options))
}

export function manifestsOf(registry, kind) {
  return Object.fromEntries(Object.entries(registry[`${kind}s`]).map(([id, record]) => [id, record.manifest]))
}

export function templateManifests(slidesPath, options) {
  return manifestsOf(loadRegistry(slidesPath, options), 'layout')
}

// Serializable listing for `mdeck extensions --json` and future editors.
export function serializeRegistry(registry, { relativeTo } = {}) {
  const out = { schema: 1, warnings: registry.warnings }
  for (const kind of KINDS) {
    out[`${kind}s`] = Object.values(registry[`${kind}s`]).map(record => ({
      ...record.manifest, kind, source: record.source,
      file: relativeTo ? relative(relativeTo, record.file) : record.file,
    }))
  }
  return out
}
