// Packages: every theme and every palette can be installed on its own, from
// mdeck itself (the built-in ones) or from the theme repository
// (https://gh.tschieber.de/mdeck-themes/). A package is one extension folder;
// it travels as one JSON file of its text files, so installing it is checking
// it and writing those files. Only extension.toml and, for a theme,
// styles.css are allowed: a package never carries code.
// What a package needs follows from its manifest: a theme needs its default
// palette, and a palette that belongs to one theme needs that theme. Those
// are installed along with it.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { resolve, relative, basename } from 'node:path'
import { ID_RE, ManifestError, RANGE_RE, parseManifestText, validateManifest } from './manifest.js'
import { builtinExtensionsRoot } from '../paths.js'

export const CATALOGUE_URL = 'https://gh.tschieber.de/mdeck-themes/catalogue.json'
export const MARKER = '.mdeck-package.json'
const PACKAGE_KINDS = ['theme', 'palette']
const FILES = { theme: ['extension.toml', 'styles.css'], palette: ['extension.toml'] }
// Where theme fonts may come from: stylesheet services that only serve fonts.
export const FONT_HOSTS = ['https://fonts.googleapis.com/', 'https://fonts.bunny.net/']

export class PackageError extends Error {}
const fail = message => { throw new PackageError(message) }

export const sha256 = text => createHash('sha256').update(text, 'utf8').digest('hex')
export const keyOf = (kind, id) => `${kind}:${id}`

export function catalogueUrl() {
  return process.env.MDECK_THEMES_URL || CATALOGUE_URL
}

const parts = version => version.split('.').map(Number)
export function compareVersions(a, b) {
  const [x, y] = [parts(a), parts(b)]
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]
  return 0
}

// Ranges are only of the form ">=1.2.3"; no range means any version.
export function satisfies(range, version) {
  if (!range) return true
  const match = RANGE_RE.exec(range)
  return Boolean(match) && compareVersions(version, match[1]) >= 0
}

function checkCss(text, where) {
  if (/@import/i.test(text)) fail(`${where}: @import is not allowed; list font stylesheets under fonts in extension.toml`)
  for (const match of text.matchAll(/url\(\s*(['"]?)([^'")]*)\1\s*\)/gi)) {
    if (!match[2].trim().startsWith('data:')) fail(`${where}: url(${match[2]}) is not allowed; only data: URLs`)
  }
}

// Checks one package's files: what it may hold, its manifest, its fonts and
// stylesheet. `published` also requires version, author and license, as the
// theme repository does. Returns the validated record.
export function checkPackage({ kind, id, files }, { published = false } = {}) {
  if (!PACKAGE_KINDS.includes(kind)) fail(`${kind} is not a kind of package; only themes and palettes are`)
  if (typeof id !== 'string' || !ID_RE.test(id)) fail(`"${id}" is not an id: lowercase letters, digits and hyphens, starting with a letter`)
  if (!files || typeof files !== 'object') fail(`The ${kind} ${id} has no files`)
  for (const [name, text] of Object.entries(files)) {
    if (!FILES[kind].includes(name)) fail(`The ${kind} ${id}: "${name}" is not allowed; a ${kind} holds only ${FILES[kind].join(' and ')}`)
    if (typeof text !== 'string') fail(`The ${kind} ${id}: ${name} is not text`)
  }
  if (!files['extension.toml']) fail(`The ${kind} ${id}: extension.toml is missing`)
  const dir = `/package/${id}`
  const file = `${dir}/extension.toml`
  let record
  try {
    record = validateManifest(parseManifestText(files['extension.toml'], file), { file, dir, folderName: id, fileExists: path => Object.hasOwn(files, relative(dir, path)) })
  } catch (error) {
    if (error instanceof ManifestError) fail(`The ${kind} ${id}: ${error.message.replace(`${file}: `, '')}`)
    throw error
  }
  if (record.kind !== kind) fail(`${id}/extension.toml says kind = "${record.kind}", but it is in the ${kind}s`)
  if (published) for (const key of ['version', 'author', 'license']) if (!record.package?.[key]) fail(`The ${kind} ${id}: ${key} is required in the theme repository`)
  if (kind === 'theme') {
    for (const url of record.manifest.fonts) if (!FONT_HOSTS.some(host => url.startsWith(host))) fail(`The theme ${id} loads fonts from ${url}; allowed are ${FONT_HOSTS.join(', ')}`)
    checkCss(files['styles.css'] ?? '', `The theme ${id}: styles.css`)
  }
  return record
}

// What a package needs installed with it: a theme its default palette, a
// palette of one theme that theme.
export function dependencies(kind, manifest) {
  if (kind === 'theme') return [{ kind: 'palette', id: manifest.palette }]
  return manifest.theme ? [{ kind: 'theme', id: manifest.theme }] : []
}

// A package folder's files and record; `kind` comes from the manifest.
export function readPackageDir(dir, { published = false } = {}) {
  const id = basename(dir)
  const files = {}
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith('.') || name === 'README.md') continue
    if (!statSync(resolve(dir, name)).isFile()) fail(`${resolve(dir, name)}: a package holds only files`)
    files[name] = readFileSync(resolve(dir, name), 'utf8')
  }
  const kind = /^kind\s*=\s*"([a-z]+)"/m.exec(files['extension.toml'] ?? '')?.[1]
  const record = checkPackage({ kind, id, files }, { published })
  return { kind, id, files, record }
}

// The published form of a package folder: one JSON text and its checksum.
export function bundlePackage(dir, options) {
  const { kind, id, files, record } = readPackageDir(dir, options)
  const bundle = { schema: 2, kind, id, version: record.package?.version ?? '0.0.0', ...(record.package?.mdeck ? { mdeck: record.package.mdeck } : {}), files }
  const text = JSON.stringify(bundle, null, 1) + '\n'
  return { bundle, text, sha256: sha256(text), record }
}

// ─── Installed packages ───────────────────────────────────────────────────

const readJson = file => { try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null } }
const packageDir = (root, kind, id) => resolve(root, `${kind}s`, id)

// Files changed since the package was installed, by name.
function changedFiles(dir, marker) {
  return Object.entries(marker.files ?? {}).filter(([name, hash]) => {
    const file = resolve(dir, name)
    return !existsSync(file) || sha256(readFileSync(file, 'utf8')) !== hash
  }).map(([name]) => name)
}

const refuseChanged = (dir, marker) => {
  const changed = changedFiles(dir, marker)
  if (changed.length) fail(`${dir} was changed since it was installed (${changed.join(', ')}); add --force to replace or remove it anyway`)
}

// The packages installed in an extensions folder (in its themes/ and
// palettes/), by "kind:id".
export function installedPackages(root) {
  const found = {}
  for (const kind of PACKAGE_KINDS) {
    const dir = resolve(root, `${kind}s`)
    if (!existsSync(dir)) continue
    for (const id of readdirSync(dir).sort()) {
      const marker = readJson(resolve(dir, id, MARKER))
      if (marker?.kind === kind) found[keyOf(kind, id)] = { kind, id, version: marker.version ?? null, url: marker.url ?? null, dir: resolve(dir, id), marker }
    }
  }
  return found
}

// Writes a checked package into an extensions folder (a deck's, or the
// user's), as <kind>s/<id>. A folder of the deck's own is never touched; one
// installed before is replaced unless it was changed by hand.
export function installPackage(bundle, { root, url = null, digest = null, force = false } = {}) {
  const { kind, id } = bundle
  const record = checkPackage(bundle)
  const dir = packageDir(root, kind, id)
  const before = installedPackages(root)[keyOf(kind, id)]
  if (existsSync(dir) && !readJson(resolve(dir, MARKER))) fail(`${dir} already exists and was not installed by mdeck; rename or remove it first`)
  if (before && !force) refuseChanged(before.dir, before.marker)
  // Files are overwritten in place, not deleted and written again, so a
  // running editor sees a change instead of a file that disappears.
  mkdirSync(dir, { recursive: true })
  const hashes = {}
  for (const [name, content] of Object.entries(bundle.files)) {
    writeFileSync(resolve(dir, name), content, 'utf8')
    hashes[name] = sha256(content)
  }
  for (const name of readdirSync(dir)) if (name !== MARKER && !Object.hasOwn(hashes, name)) rmSync(resolve(dir, name), { recursive: true, force: true })
  writeFileSync(resolve(dir, MARKER), JSON.stringify({ kind, id, version: bundle.version, url, sha256: digest, files: hashes }, null, 2) + '\n')
  return { record, dir, replaced: before?.version ?? null }
}

export function removePackage(kind, id, { root, force = false } = {}) {
  const installed = installedPackages(root)[keyOf(kind, id)]
  if (!installed) fail(`The ${kind} ${id} is not installed in ${root}`)
  if (!force) refuseChanged(installed.dir, installed.marker)
  rmSync(installed.dir, { recursive: true, force: true })
  return installed
}

// ─── The catalogue: built-in packages and the repository ──────────────────

async function get(url, as) {
  let response
  try { response = await fetch(url) } catch (error) { fail(`Could not reach ${url}: ${error.cause?.message ?? error.message}`) }
  if (!response.ok) fail(`${url} answered ${response.status}`)
  return as === 'json' ? response.json() : response.text()
}

export async function fetchCatalogue(url = catalogueUrl()) {
  const data = await get(url, 'json')
  if (data?.schema !== 2 || !Array.isArray(data.themes) || !Array.isArray(data.palettes)) fail(`${url} is not a theme repository catalogue`)
  return data
}

// One entry of the catalogue, from a package's record.
function entryOf(kind, record) {
  return {
    kind, id: record.id, title: record.title, description: record.description ?? '',
    version: record.package?.version ?? '0.0.0', ...(record.package?.author ? { author: record.package.author } : {}), ...(record.package?.license ? { license: record.package.license } : {}),
    ...(record.package?.homepage ? { homepage: record.package.homepage } : {}), ...(record.package?.mdeck ? { mdeck: record.package.mdeck } : {}),
    ...(kind === 'theme' ? { palette: record.manifest.palette, ...(record.manifest.palettes?.length ? { palettes: record.manifest.palettes } : {}), appearance: record.manifest.appearance ?? 'light',
      ...(record.manifest.guide ? { guide: record.manifest.guide } : {}) } : {}),
    ...(kind === 'palette' && record.manifest.theme ? { theme: record.manifest.theme } : {}),
  }
}

// The themes and palettes that come with mdeck, as catalogue entries.
export function builtInEntries(root = builtinExtensionsRoot) {
  const entries = []
  for (const kind of PACKAGE_KINDS) {
    const dir = resolve(root, `${kind}s`)
    if (!existsSync(dir)) continue
    for (const id of readdirSync(dir).sort()) {
      if (id.startsWith('.')) continue
      const { record } = readPackageDir(resolve(dir, id))
      entries.push({ ...entryOf(kind, record), builtIn: true, dir: resolve(dir, id) })
    }
  }
  return entries
}

// Every theme and palette mdeck can install: the built-in ones, and the
// repository's when it answers. Of two versions the newer is offered; the
// built-in one on a tie, since it needs no download. `offline` says why the
// repository is missing.
export async function loadCatalogue({ url = catalogueUrl(), online = true } = {}) {
  const entries = new Map(builtInEntries().map(entry => [keyOf(entry.kind, entry.id), entry]))
  let offline = null
  let remote = { themes: [], palettes: [] }
  if (online) { try { remote = await fetchCatalogue(url) } catch (error) { offline = error.message } }
  for (const entry of [...remote.themes.map(e => ({ ...e, kind: 'theme' })), ...remote.palettes.map(e => ({ ...e, kind: 'palette' }))]) {
    const key = keyOf(entry.kind, entry.id)
    const have = entries.get(key)
    if (entry.builtIn) { if (have) have.preview = entry.preview; continue }
    if (!have || compareVersions(entry.version, have.version) > 0) entries.set(key, { ...entry, builtIn: false, builtInVersion: have?.version })
  }
  const sorted = [...entries.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id, 'en'))
  return { url, offline, entries: sorted, get: (kind, id) => entries.get(keyOf(kind, id)) }
}

export function findEntry(catalogue, kind, id) {
  return catalogue.get(kind, id) ?? fail(`There is no ${kind} "${id}"${catalogue.offline ? ` among those that come with mdeck, and the theme repository could not be reached (${catalogue.offline})` : `; mdeck ${kind}s search lists them`}`)
}

// A package's files: read from mdeck's folder, or downloaded and checked
// against the repository's checksum.
export async function obtainPackage(catalogue, entry) {
  if (entry.builtIn) { const { bundle, sha256: digest } = bundlePackage(entry.dir); return { bundle, url: null, digest } }
  const url = new URL(entry.url, catalogue.url).href
  const text = await get(url, 'text')
  if (sha256(text) !== entry.sha256) fail(`${url} does not match its checksum in the catalogue; not installed`)
  let bundle
  try { bundle = JSON.parse(text) } catch { fail(`${url} is not a package`) }
  if (bundle.kind !== entry.kind || bundle.id !== entry.id || bundle.version !== entry.version) fail(`${url} holds the ${bundle.kind} ${bundle.id} ${bundle.version}, not the ${entry.kind} ${entry.id} ${entry.version}`)
  return { bundle, url, digest: entry.sha256 }
}

// A package and what it needs, in the order to install them: what is needed
// first, the package itself last. A theme and its own palette need each
// other; each is installed once.
export function withDependencies(catalogue, kind, id, seen = new Set()) {
  const key = keyOf(kind, id)
  if (seen.has(key)) return []
  seen.add(key)
  const entry = findEntry(catalogue, kind, id)
  const needs = kind === 'theme' ? [{ kind: 'palette', id: entry.palette }] : entry.theme ? [{ kind: 'theme', id: entry.theme }] : []
  const order = []
  for (const need of needs) for (const item of withDependencies(catalogue, need.kind, need.id, seen)) if (!order.includes(item)) order.push(item)
  return [...order, entry]
}

// ─── The repository itself ────────────────────────────────────────────────

// The theme repository as served: catalogue.json, and <kind>s/<id>-<version>.json
// for each package, from a folder with themes/ and palettes/. mdeck's
// built-in packages are listed too (marked builtIn), so the repository's
// themes may use built-in palettes. Every package is checked, no id appears
// twice in a kind, and what each needs is in the catalogue. Previews are added
// by the caller.
export function buildRepository(repoDir, outDir) {
  const builtIn = builtInEntries()
  const records = {}
  const add = (kind, id, value) => {
    if (records[keyOf(kind, id)]) fail(`There are two ${kind}s "${id}"${value.builtIn || records[keyOf(kind, id)].builtIn ? '; one comes with mdeck, change it there' : ''}`)
    records[keyOf(kind, id)] = value
  }
  for (const entry of builtIn) add(entry.kind, entry.id, { entry, builtIn: true, ...bundlePackage(entry.dir) })
  for (const kind of PACKAGE_KINDS) {
    const dir = resolve(repoDir, `${kind}s`)
    if (!existsSync(dir)) continue
    for (const id of readdirSync(dir).sort()) {
      if (id.startsWith('.') || !statSync(resolve(dir, id)).isDirectory()) continue
      const read = bundlePackage(resolve(dir, id), { published: true })
      if (read.bundle.kind !== kind) fail(`${kind}s/${id} holds a ${read.bundle.kind}`)
      add(kind, id, { entry: entryOf(kind, read.record), builtIn: false, dir: resolve(dir, id), ...read })
    }
  }
  // What each needs must be there, and a theme may offer only palettes that
  // are open to it.
  for (const { record, bundle } of Object.values(records)) {
    for (const need of dependencies(bundle.kind, record.manifest)) {
      if (!records[keyOf(need.kind, need.id)]) fail(`The ${bundle.kind} ${bundle.id} needs the ${need.kind} "${need.id}", which is neither in the repository nor built into mdeck`)
    }
    if (bundle.kind === 'theme') for (const id of [record.manifest.palette, ...(record.manifest.palettes ?? [])]) {
      const palette = records[keyOf('palette', id)]
      if (!palette) fail(`The theme ${bundle.id} offers the palette "${id}", which is neither in the repository nor built into mdeck`)
      const owner = palette.record.manifest.theme
      if (owner && owner !== bundle.id) fail(`The theme ${bundle.id} offers the palette ${id}, which belongs to the theme ${owner}`)
    }
  }
  const catalogue = { schema: 2, themes: [], palettes: [] }
  for (const key of Object.keys(records).sort()) {
    const { entry, text, sha256: digest, bundle, builtIn: isBuiltIn } = records[key]
    const file = `${bundle.kind}s/${bundle.id}-${bundle.version}.json`
    mkdirSync(resolve(outDir, `${bundle.kind}s`), { recursive: true })
    writeFileSync(resolve(outDir, file), text)
    const { dir, ...listed } = entry
    catalogue[`${bundle.kind}s`].push({ ...listed, ...(isBuiltIn ? { builtIn: true } : {}), url: file, sha256: digest })
  }
  writeFileSync(resolve(outDir, 'catalogue.json'), JSON.stringify(catalogue, null, 2) + '\n')
  return { catalogue, dirs: Object.fromEntries(Object.entries(records).map(([key, value]) => [key, value.dir ?? value.entry.dir])) }
}
