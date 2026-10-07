// Packs: every theme and palette comes in one. A pack is a folder with
// pack.toml and one folder per theme or palette; it travels as one JSON file
// of text files, so installing it is checking it and writing those files.
// Only extension.toml and styles.css are allowed: a pack never carries code.
// A pack may require others (`requires = ["lagoon"]`) for palettes its
// themes name. Packs come from two places: the starter set bundled with
// mdeck (assets/packs), and the theme repository
// (https://gh.tschieber.de/mdeck-themes/).
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { parse } from 'smol-toml'
import { ID_RE, ManifestError, parseManifestText, validateManifest } from './manifest.js'

export const INDEX_URL = 'https://gh.tschieber.de/mdeck-themes/index.json'
export const MARKER = '.mdeck-pack.json'
export const PACK_FILE = 'pack.toml'
const FILES = ['extension.toml', 'styles.css']
const FILE_RE = /^([a-z][a-z0-9-]*)\/(extension\.toml|styles\.css)$/
const VERSION_RE = /^\d+\.\d+\.\d+$/
const RANGE_RE = /^>=\s*(\d+\.\d+\.\d+)$/
// Where theme fonts may come from: stylesheet services that only serve fonts.
export const FONT_HOSTS = ['https://fonts.googleapis.com/', 'https://fonts.bunny.net/']

export class PackError extends Error {}
const fail = message => { throw new PackError(message) }

export const sha256 = text => createHash('sha256').update(text, 'utf8').digest('hex')

export function indexUrl() {
  return process.env.MDECK_THEMES_URL || INDEX_URL
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

function checkMeta(meta, where) {
  if (meta.schema !== 1) fail(`${where}: schema must be 1`)
  if (typeof meta.id !== 'string' || !ID_RE.test(meta.id)) fail(`${where}: id must use lowercase letters, digits and hyphens, starting with a letter`)
  if (typeof meta.version !== 'string' || !VERSION_RE.test(meta.version)) fail(`${where}: version must look like 1.0.0`)
  if (meta.mdeck != null && (typeof meta.mdeck !== 'string' || !RANGE_RE.test(meta.mdeck))) fail(`${where}: mdeck must look like ">=2.3.0"`)
  if (meta.requires != null && (!Array.isArray(meta.requires) || meta.requires.some(id => typeof id !== 'string' || !ID_RE.test(id) || id === meta.id))) fail(`${where}: requires must be a list of other packs' ids`)
}

// pack.toml and the files of each theme or palette in a pack folder.
export function readPackDir(dir) {
  const file = resolve(dir, PACK_FILE)
  if (!existsSync(file)) fail(`${dir} has no ${PACK_FILE}`)
  let meta
  try { meta = parse(readFileSync(file, 'utf8')) } catch (error) { fail(`${file}: ${error.message.split('\n')[0]}`) }
  checkMeta(meta, file)
  for (const key of ['title', 'author', 'license']) if (typeof meta[key] !== 'string' || !meta[key].trim()) fail(`${file}: ${key} is required`)
  const folder = dir.split(/[\\/]/).filter(Boolean).at(-1)
  if (meta.id !== folder) fail(`${file}: id "${meta.id}" must be the folder name "${folder}"`)
  const files = {}
  for (const entry of readdirSync(dir).sort()) {
    if (entry === PACK_FILE || entry.startsWith('.') || entry === 'README.md') continue
    const sub = resolve(dir, entry)
    if (!statSync(sub).isDirectory()) fail(`${sub}: a pack holds only ${PACK_FILE}, README.md and one folder per theme or palette`)
    for (const name of readdirSync(sub).sort()) {
      if (!FILES.includes(name)) fail(`${resolve(sub, name)}: a theme or palette in a pack holds only ${FILES.join(' and ')}`)
      files[`${entry}/${name}`] = readFileSync(resolve(sub, name), 'utf8')
    }
  }
  return { meta, files }
}

// The published form of a pack folder: one JSON text and its checksum.
export function bundlePack(dir) {
  const { meta, files } = readPackDir(dir)
  const bundle = { schema: 1, id: meta.id, version: meta.version, ...(meta.mdeck ? { mdeck: meta.mdeck } : {}), ...(meta.requires?.length ? { requires: meta.requires } : {}), files }
  const text = JSON.stringify(bundle, null, 1) + '\n'
  return { meta, bundle, text, sha256: sha256(text) }
}

function checkCss(text, where) {
  if (/@import/i.test(text)) fail(`${where}: @import is not allowed; list font stylesheets under fonts in extension.toml`)
  for (const match of text.matchAll(/url\(\s*(['"]?)([^'")]*)\1\s*\)/gi)) {
    if (!match[2].trim().startsWith('data:')) fail(`${where}: url(${match[2]}) is not allowed; only data: URLs`)
  }
}

// Checks a pack before it is published or installed. `provided` holds the
// themes and palettes of the packs it requires ({ themes, palettes } by id),
// for those its themes name; `owners` maps ids to the packs that have them,
// so no pack takes another's id. Returns the ids and manifests it holds.
export function checkPack(bundle, { provided = { themes: {}, palettes: {} }, owners = {} } = {}) {
  if (!bundle || typeof bundle !== 'object' || typeof bundle.files !== 'object' || !bundle.files) fail('Not a pack')
  checkMeta(bundle, `Pack ${bundle.id ?? '?'}`)
  const byId = {}
  for (const [path, text] of Object.entries(bundle.files)) {
    const match = FILE_RE.exec(path)
    if (!match) fail(`${bundle.id}: "${path}" is not allowed; a pack holds only <id>/extension.toml and <id>/styles.css`)
    if (typeof text !== 'string') fail(`${bundle.id}: ${path} is not text`)
    ;(byId[match[1]] ??= {})[match[2]] = text
  }
  if (!Object.keys(byId).length) fail(`${bundle.id}: the pack is empty`)
  const records = []
  for (const [id, files] of Object.entries(byId)) {
    if (!files['extension.toml']) fail(`${bundle.id}: ${id}/extension.toml is missing`)
    const dir = `/pack/${id}`
    const file = `${dir}/extension.toml`
    let record
    try {
      record = validateManifest(parseManifestText(files['extension.toml'], file), { file, dir, folderName: id, fileExists: path => Object.hasOwn(files, relative(dir, path)) })
    } catch (error) {
      if (error instanceof ManifestError) fail(`${bundle.id}: ${id}/extension.toml: ${error.message}`)
      throw error
    }
    if (!['theme', 'palette'].includes(record.kind)) fail(`${bundle.id}: ${id} is a ${record.kind}; packs hold only themes and palettes`)
    if (files['styles.css'] !== undefined && record.kind !== 'theme') fail(`${bundle.id}: ${id}/styles.css belongs only to a theme`)
    if (record.kind === 'theme') {
      for (const url of record.manifest.fonts) if (!FONT_HOSTS.some(host => url.startsWith(host))) fail(`${bundle.id}: ${id} loads fonts from ${url}; allowed are ${FONT_HOSTS.join(', ')}`)
      checkCss(files['styles.css'] ?? '', `${bundle.id}: ${id}/styles.css`)
    }
    if (owners[id] && owners[id] !== bundle.id) fail(`${bundle.id}: ${id} is already the id of a theme or palette in the pack ${owners[id]}`)
    records.push(record)
  }
  const mine = kind => Object.fromEntries(records.filter(r => r.kind === kind).map(r => [r.id, r.manifest]))
  const themes = mine('theme'), palettes = mine('palette')
  const requires = bundle.requires?.length ? ` or in ${bundle.requires.join(', ')}` : ''
  for (const record of records) {
    if (record.kind === 'theme') for (const id of [record.manifest.palette, ...(record.manifest.palettes ?? [])]) {
      if (!palettes[id] && !provided.palettes[id]) fail(`${bundle.id}: the theme ${record.id} names the palette "${id}", which is not in the pack${requires}; add the pack that has it to requires`)
    }
    if (record.kind === 'palette' && record.manifest.theme && !themes[record.manifest.theme] && !provided.themes[record.manifest.theme]) fail(`${bundle.id}: the palette ${record.id} belongs to the theme "${record.manifest.theme}", which is not in the pack${requires}`)
  }
  return { themes: Object.keys(themes), palettes: Object.keys(palettes), manifests: { themes, palettes } }
}

function readMarker(dir) {
  try { return JSON.parse(readFileSync(resolve(dir, MARKER), 'utf8')) } catch { return null }
}

// Files changed since the pack was installed, by name.
function changedFiles(dir, marker) {
  return Object.entries(marker.files ?? {}).filter(([name, hash]) => {
    const file = resolve(dir, name)
    return !existsSync(file) || sha256(readFileSync(file, 'utf8')) !== hash
  }).map(([name]) => name)
}

// The packs installed in an extensions folder: { id: { version, url, folders } }.
export function installedPacks(root) {
  const packs = {}
  if (!existsSync(root)) return packs
  for (const entry of readdirSync(root).sort()) {
    const marker = readMarker(resolve(root, entry))
    if (!marker?.pack) continue
    const pack = packs[marker.pack] ??= { version: marker.version, url: marker.url, requires: marker.requires ?? [], folders: [] }
    pack.folders.push(entry)
  }
  return packs
}

const refuseChanged = (root, folder, marker) => {
  const changed = changedFiles(resolve(root, folder), marker)
  if (changed.length) fail(`${resolve(root, folder)} was changed since it was installed (${changed.join(', ')}); add --force to replace or remove it anyway`)
}

// Writes a checked pack into an extensions folder (a deck's, or the user's).
// A folder of another pack or of the deck itself is never touched; a folder
// of this pack is replaced unless it was changed by hand.
export function installPack(bundle, { root, provided, owners, url = null, digest = null, force = false } = {}) {
  const { themes, palettes } = checkPack(bundle, { provided, owners })
  const ids = [...themes, ...palettes]
  const before = installedPacks(root)[bundle.id]
  for (const id of ids) {
    const dir = resolve(root, id)
    if (!existsSync(dir)) continue
    const marker = readMarker(dir)
    if (marker?.pack !== bundle.id) fail(`${dir} already exists and is not from the pack ${bundle.id}; rename or remove it first`)
    if (!force) refuseChanged(root, id, marker)
  }
  const gone = (before?.folders ?? []).filter(folder => !ids.includes(folder))
  if (!force) for (const folder of gone) refuseChanged(root, folder, readMarker(resolve(root, folder)))
  for (const folder of gone) rmSync(resolve(root, folder), { recursive: true, force: true })
  for (const id of ids) {
    // Files are overwritten in place, not deleted and written again, so a
    // running editor sees a change instead of a file that disappears.
    const dir = resolve(root, id)
    mkdirSync(dir, { recursive: true })
    const hashes = {}
    for (const [path, content] of Object.entries(bundle.files)) {
      if (!path.startsWith(`${id}/`)) continue
      const name = path.slice(id.length + 1)
      writeFileSync(resolve(dir, name), content, 'utf8')
      hashes[name] = sha256(content)
    }
    for (const name of readdirSync(dir)) if (name !== MARKER && !Object.hasOwn(hashes, name)) rmSync(resolve(dir, name), { recursive: true, force: true })
    writeFileSync(resolve(dir, MARKER), JSON.stringify({ pack: bundle.id, version: bundle.version, ...(bundle.requires?.length ? { requires: bundle.requires } : {}), url, sha256: digest, files: hashes }, null, 2) + '\n')
  }
  return { themes, palettes, replaced: before?.version ?? null }
}

export function removePack(id, { root, force = false } = {}) {
  const pack = installedPacks(root)[id]
  if (!pack) fail(`The pack ${id} is not installed in ${root}`)
  if (!force) for (const folder of pack.folders) refuseChanged(root, folder, readMarker(resolve(root, folder)))
  for (const folder of pack.folders) rmSync(resolve(root, folder), { recursive: true, force: true })
  return pack
}

async function get(url, as) {
  let response
  try { response = await fetch(url) } catch (error) { fail(`Could not reach ${url}: ${error.cause?.message ?? error.message}`) }
  if (!response.ok) fail(`${url} answered ${response.status}`)
  return as === 'json' ? response.json() : response.text()
}

export async function fetchIndex(url = indexUrl()) {
  const index = await get(url, 'json')
  if (index?.schema !== 1 || !Array.isArray(index.packs)) fail(`${url} is not a theme repository index`)
  return { url, packs: index.packs }
}

// Downloads a pack listed in the index and checks that it is the one listed.
export async function fetchPack(index, entry) {
  const url = new URL(entry.url, index.url).href
  const text = await get(url, 'text')
  if (sha256(text) !== entry.sha256) fail(`${url} does not match its checksum in the index; not installed`)
  let bundle
  try { bundle = JSON.parse(text) } catch { fail(`${url} is not a pack`) }
  if (bundle.id !== entry.id || bundle.version !== entry.version) fail(`${url} holds ${bundle.id} ${bundle.version}, not ${entry.id} ${entry.version}`)
  return { bundle, url, digest: entry.sha256 }
}

// ─── The catalogue: bundled packs and the repository ──────────────────────

// A bundled pack as the catalogue lists it.
function bundledEntry(id, dir) {
  const { meta, bundle, sha256: digest } = bundlePack(dir)
  const { themes, palettes } = checkPack(bundle)
  return { id, title: meta.title, description: meta.description ?? '', version: meta.version, author: meta.author, license: meta.license,
    ...(meta.mdeck ? { mdeck: meta.mdeck } : {}), requires: meta.requires ?? [], themes, palettes, sha256: digest, bundled: true, dir }
}

// Every pack mdeck can install: the bundled ones, and the repository's when
// it answers. Of two versions of one pack the newer is offered; the bundled
// one on a tie, since it needs no download. `offline` says why the
// repository is missing.
export async function loadCatalogue({ bundled = {}, url = indexUrl(), online = true } = {}) {
  const packs = new Map(Object.entries(bundled).map(([id, dir]) => [id, bundledEntry(id, dir)]))
  let offline = null, index = { url, packs: [] }
  if (online) { try { index = await fetchIndex(url) } catch (error) { offline = error.message } }
  for (const entry of index.packs) {
    const have = packs.get(entry.id)
    if (!have || compareVersions(entry.version, have.version) > 0) packs.set(entry.id, { ...entry, requires: entry.requires ?? [], bundled: false, bundledVersion: have?.version })
    else if (have.bundled) have.repository = entry
  }
  return { url, offline, packs: [...packs.values()].sort((a, b) => a.id.localeCompare(b.id, 'en')) }
}

export function findPack(catalogue, id) {
  return catalogue.packs.find(pack => pack.id === id) ?? fail(`There is no pack "${id}"${catalogue.offline ? ` among those that come with mdeck, and the theme repository could not be reached (${catalogue.offline})` : `; mdeck themes search lists them`}`)
}

// The ids every pack in the catalogue has, so packs do not take each other's.
export const ownersIn = catalogue => Object.fromEntries(catalogue.packs.flatMap(pack => [...pack.themes, ...pack.palettes].map(id => [id, pack.id])))

// A pack's files: read from mdeck's folder, or downloaded and checked
// against the repository's checksum.
export async function obtainPack(catalogue, entry) {
  if (entry.bundled) { const { bundle, sha256: digest } = bundlePack(entry.dir); return { bundle, url: null, digest } }
  return fetchPack({ url: catalogue.url }, entry)
}

// A pack and the packs it requires, in the order to install them; the pack
// itself last.
export function withRequirements(catalogue, id, seen = []) {
  if (seen.includes(id)) fail(`The packs ${[...seen, id].join(' → ')} require each other in a circle`)
  const entry = findPack(catalogue, id)
  const order = []
  for (const required of entry.requires ?? []) for (const pack of withRequirements(catalogue, required, [...seen, id])) if (!order.includes(pack)) order.push(pack)
  return [...order, entry]
}

// Installs a pack and what it requires into an extensions folder. A required
// pack that `has(id)` says is there already is left as it is. `bundledHere`
// handles a bundled pack without writing it (for the user's folder, where the
// bundled one is offered anyway); it returns true when it did.
export async function installWithRequirements(catalogue, id, { root, mdeckVersion, force = false, has = () => false, bundledHere = null }) {
  const owners = ownersIn(catalogue)
  const provided = { themes: {}, palettes: {} }
  const done = []
  for (const entry of withRequirements(catalogue, id)) {
    if (!satisfies(entry.mdeck, mdeckVersion)) fail(`${entry.id} ${entry.version} needs mdeck ${entry.mdeck}; this is ${mdeckVersion}. Update mdeck first: npm install -g mdeck`)
    const { bundle, url, digest } = await obtainPack(catalogue, entry)
    const { manifests } = checkPack(bundle, { provided, owners })
    const target = entry.id === id
    if (!target && has(entry.id)) done.push({ id: entry.id, version: entry.version, kept: true })
    else if (entry.bundled && bundledHere?.(entry)) done.push({ id: entry.id, version: entry.version, bundled: true, themes: Object.keys(manifests.themes), palettes: Object.keys(manifests.palettes) })
    else done.push({ id: entry.id, version: entry.version, ...installPack(bundle, { root, provided, owners, url, digest, force }) })
    Object.assign(provided.themes, manifests.themes)
    Object.assign(provided.palettes, manifests.palettes)
  }
  return done
}

// ─── The repository itself ────────────────────────────────────────────────

// The theme repository as served: index.json and packs/<id>-<version>.json,
// from a folder of pack folders and mdeck's bundled packs (marked bundled).
// Each pack is checked with only the packs it requires, as it is installed;
// no two packs may share an id. Previews are added by the caller.
export function buildRepository(packsDir, outDir, { bundled = {} } = {}) {
  const dirs = { ...Object.fromEntries(readdirSync(packsDir).filter(name => !name.startsWith('.') && statSync(resolve(packsDir, name)).isDirectory()).map(name => [name, resolve(packsDir, name)])) }
  for (const [id, dir] of Object.entries(bundled)) {
    if (dirs[id]) fail(`${id} comes with mdeck; change it there instead of in ${packsDir}`)
    dirs[id] = dir
  }
  const read = Object.fromEntries(Object.entries(dirs).map(([id, dir]) => [id, bundlePack(dir)]))
  const owners = {}
  for (const [id, { bundle }] of Object.entries(read)) {
    for (const ext of Object.keys(bundle.files).map(path => path.split('/')[0])) {
      if (owners[ext] && owners[ext] !== id) fail(`${ext} is in both ${owners[ext]} and ${id}`)
      owners[ext] = id
    }
  }
  const checked = {}
  const check = (id, seen = []) => {
    if (checked[id]) return checked[id]
    if (!read[id]) fail(`${seen.at(-1)} requires ${id}, which is not in the repository`)
    if (seen.includes(id)) fail(`The packs ${[...seen, id].join(' → ')} require each other in a circle`)
    const provided = { themes: {}, palettes: {} }
    for (const required of read[id].bundle.requires ?? []) {
      const result = check(required, [...seen, id])
      Object.assign(provided.themes, result.provides.themes); Object.assign(provided.palettes, result.provides.palettes)
    }
    const result = checkPack(read[id].bundle, { provided, owners })
    return checked[id] = { ...result, provides: { themes: { ...provided.themes, ...result.manifests.themes }, palettes: { ...provided.palettes, ...result.manifests.palettes } } }
  }
  mkdirSync(resolve(outDir, 'packs'), { recursive: true })
  const entries = Object.keys(read).sort((a, b) => a.localeCompare(b, 'en')).map(id => {
    const { meta, text, sha256: digest } = read[id]
    const { themes, palettes } = check(id)
    const file = `packs/${meta.id}-${meta.version}.json`
    writeFileSync(resolve(outDir, file), text)
    return { id: meta.id, title: meta.title, description: meta.description ?? '', version: meta.version, author: meta.author, license: meta.license,
      ...(meta.homepage ? { homepage: meta.homepage } : {}), ...(meta.mdeck ? { mdeck: meta.mdeck } : {}), ...(meta.requires?.length ? { requires: meta.requires } : {}),
      ...(bundled[id] ? { bundled: true } : {}), themes, palettes, url: file, sha256: digest }
  })
  const index = { schema: 1, packs: entries }
  writeFileSync(resolve(outDir, 'index.json'), JSON.stringify(index, null, 2) + '\n')
  return index
}
