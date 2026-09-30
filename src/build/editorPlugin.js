// Local editing API for `mdeck edit`. The server is a guarded file writer:
// it only ever writes the one deck path, rejects stale writes with the
// current content, and tells the editor when the file changed on disk.
// Before its first write it copies the file into .mdeck-backups/ beside it.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, unlinkSync } from 'node:fs'
import { resolve, basename, dirname, relative } from 'node:path'
import { loadRegistry, serializeRegistry } from '../extensions/discover.js'
import { ManifestError, KINDS, ID_RE, MANIFEST_FILENAME, parseManifestText, validateManifest } from '../extensions/manifest.js'

const BODY_LIMIT = 32 * 1024 * 1024
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

export function hashSource(source) {
  return createHash('sha1').update(source, 'utf8').digest('hex')
}

export const BACKUP_DIR = '.mdeck-backups'
const BACKUPS_KEPT = 10

// Copies the deck as it is now to .mdeck-backups/<name>-<time>.md and keeps
// the newest few copies of this deck.
export function backupDeck(abs, source, now = new Date()) {
  const dir = resolve(dirname(abs), BACKUP_DIR)
  mkdirSync(dir, { recursive: true })
  const name = basename(abs).replace(/\.md$/i, '')
  const stamp = now.toISOString().replace(/[:.]/g, '-').replace(/-\d{3}Z$/, 'Z')
  const file = resolve(dir, `${name}-${stamp}.md`)
  writeFileSync(file, source, 'utf8')
  const prefix = `${name}-`
  const copies = readdirSync(dir).filter(entry => entry.startsWith(prefix) && /^\d{4}-\d{2}-\d{2}T[\d-]+Z\.md$/.test(entry.slice(prefix.length))).sort()
  for (const old of copies.slice(0, -BACKUPS_KEPT)) unlinkSync(resolve(dir, old))
  return file
}

export function createDeckFile(abs, { backup = true } = {}) {
  let lastWritten = null
  let backupFile = null
  const read = () => {
    const source = readFileSync(abs, 'utf8')
    return { source, hash: hashSource(source) }
  }
  return {
    path: abs,
    read,
    write(source, base) {
      if (!existsSync(abs)) return { ok: false, conflict: true, source: null, hash: null }
      const current = read()
      if (base !== current.hash) return { ok: false, conflict: true, ...current }
      if (backup && !backupFile && source !== current.source) backupFile = backupDeck(abs, current.source)
      writeFileSync(abs, source, 'utf8')
      lastWritten = source
      return { ok: true, hash: hashSource(source) }
    },
    isExternalChange(content) { return content !== lastWritten },
    get backupFile() { return backupFile },
  }
}

function hostname(host = '') {
  const match = host.match(/^(\[[^\]]*\]|[^:]+)(?::\d+)?$/)
  return match ? match[1].toLowerCase() : ''
}

// Names under .localhost always mean this computer and are never looked up
// in DNS (RFC 6761), so local proxies such as `name.localhost` count too.
const isLoopbackName = name => LOOPBACK.has(name) || name.endsWith('.localhost')

// Browsers send Origin on cross-site requests; a page served by this server
// has the same host. Everything else is refused, and only loopback hosts are
// served at all.
export function isAllowedRequest(request) {
  const host = request.headers.host ?? ''
  if (!isLoopbackName(hostname(host))) return false
  const origin = request.headers.origin
  if (origin == null) return true
  try { return new URL(origin).host.toLowerCase() === host.toLowerCase() } catch { return false }
}

export function send(response, status, body) {
  const text = JSON.stringify(body)
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(text), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  response.end(text)
}

export function readJson(request) {
  return new Promise((resolvePromise, reject) => {
    const type = request.headers['content-type'] ?? ''
    if (!/^application\/json\b/i.test(type)) return reject(Object.assign(new Error('Send JSON with Content-Type: application/json'), { status: 415 }))
    const chunks = []
    let size = 0
    request.on('data', chunk => {
      size += chunk.length
      if (size > BODY_LIMIT) { reject(Object.assign(new Error('Request body too large'), { status: 413 })); request.destroy(); return }
      chunks.push(chunk)
    })
    request.on('end', () => {
      try { resolvePromise(JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch { reject(Object.assign(new Error('Request body is not valid JSON'), { status: 400 })) }
    })
    request.on('error', reject)
  })
}

// ─── Deck-local extensions ────────────────────────────────────────────────
// Extension folders beside the deck can be read, written and removed. Built-in
// extensions are readable only. File names are plain basenames inside the
// extension folder; the manifest must validate before anything is written.

const FILE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const TEXT_FILE_RE = /\.(toml|jsx|js|css|md|txt|json)$/i

export function createExtensionStore(deckDir, { registryFor }) {
  const root = resolve(deckDir, 'extensions')
  const folder = id => resolve(root, id)
  const check = (kind, id) => {
    if (!KINDS.includes(kind)) throw Object.assign(new Error('Unknown extension kind'), { status: 400 })
    if (typeof id !== 'string' || !ID_RE.test(id)) throw Object.assign(new Error('Extension ids use lowercase letters, digits and hyphens and start with a letter'), { status: 400 })
  }
  const readFolder = dir => Object.fromEntries(readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isFile() && TEXT_FILE_RE.test(entry.name) && FILE_NAME_RE.test(entry.name))
    .map(entry => [entry.name, readFileSync(resolve(dir, entry.name), 'utf8')]))
  return {
    root,
    read(kind, id) {
      check(kind, id)
      const record = registryFor()[`${kind}s`][id]
      if (!record) throw Object.assign(new Error(`No ${kind} "${id}"`), { status: 404 })
      return { kind, id, source: record.source, dir: record.dir, files: readFolder(record.dir), manifest: record.manifest }
    },
    // Validates the manifest against the files that will exist, then writes.
    write(kind, id, files) {
      check(kind, id)
      if (!files || typeof files !== 'object' || Array.isArray(files)) throw Object.assign(new Error('Expected files: { name: text | null }'), { status: 400 })
      for (const [name, text] of Object.entries(files)) {
        if (!FILE_NAME_RE.test(name) || !TEXT_FILE_RE.test(name)) throw Object.assign(new Error(`Cannot write "${name}"`), { status: 400 })
        if (text !== null && typeof text !== 'string') throw Object.assign(new Error(`"${name}" must be text or null`), { status: 400 })
      }
      const registry = registryFor()
      const existing = registry[`${kind}s`][id]
      if (existing && existing.source !== 'local') throw Object.assign(new Error(`"${id}" is built into mdeck; copy it into this deck under a new id to change it`), { status: 403 })
      for (const other of KINDS.filter(k => k !== kind)) if (registry[`${other}s`][id]) throw Object.assign(new Error(`"${id}" is already a ${other}`), { status: 409 })
      const dir = folder(id)
      const current = existsSync(dir) ? readFolder(dir) : {}
      const next = { ...current }
      for (const [name, text] of Object.entries(files)) { if (text === null) delete next[name]; else next[name] = text }
      if (typeof next[MANIFEST_FILENAME] !== 'string') throw Object.assign(new Error(`${MANIFEST_FILENAME} is required`), { status: 400 })
      const manifestPath = resolve(dir, MANIFEST_FILENAME)
      const record = validateManifest(parseManifestText(next[MANIFEST_FILENAME], manifestPath), {
        file: manifestPath, dir, folderName: id, fileExists: path => Object.hasOwn(next, relative(dir, path)),
      })
      if (record.kind !== kind) throw Object.assign(new Error(`The manifest says kind = "${record.kind}", not "${kind}"`), { status: 400 })
      mkdirSync(dir, { recursive: true })
      for (const [name, text] of Object.entries(files)) {
        const path = resolve(dir, name)
        if (text === null) { if (existsSync(path)) unlinkSync(path) } else writeFileSync(path, text, 'utf8')
      }
      return { kind, id, dir, files: readFolder(dir) }
    },
    remove(kind, id) {
      check(kind, id)
      const record = registryFor()[`${kind}s`][id]
      if (!record) throw Object.assign(new Error(`No ${kind} "${id}"`), { status: 404 })
      if (record.source !== 'local') throw Object.assign(new Error(`"${id}" is built into mdeck and cannot be removed`), { status: 403 })
      rmSync(record.dir, { recursive: true, force: true })
      return { kind, id }
    },
  }
}

export function editorMiddleware(deckFile, { registryFor, extensions = createExtensionStore(dirname(deckFile.path), { registryFor }) }) {
  return async (request, response, next) => {
    const pathname = new URL(request.url, 'http://localhost').pathname
    if (!isAllowedRequest(request)) return send(response, 403, { error: 'Requests are only accepted from this editor on this computer' })
    try {
      const extension = pathname.match(/^\/extension\/([a-z]+)\/([^/]+)$/)
      if (extension) {
        const [, kind, id] = extension
        if (request.method === 'GET') return send(response, 200, extensions.read(kind, id))
        if (request.method === 'PUT') {
          const body = await readJson(request)
          const result = extensions.write(kind, id, body?.files)
          return send(response, 200, { ...result, registry: serializeRegistry(registryFor()) })
        }
        if (request.method === 'DELETE') {
          const result = extensions.remove(kind, id)
          return send(response, 200, { ...result, registry: serializeRegistry(registryFor()) })
        }
        response.setHeader('Allow', 'GET, PUT, DELETE')
        return send(response, 405, { error: 'Method not allowed' })
      }
      if (pathname === '/deck' && request.method === 'GET') {
        const registry = registryFor()
        return send(response, 200, { path: deckFile.path, name: basename(deckFile.path), ...deckFile.read(), registry: serializeRegistry(registry), warnings: registry.warnings })
      }
      if (pathname === '/source' && request.method === 'POST') {
        const body = await readJson(request)
        if (typeof body?.source !== 'string' || typeof body?.base !== 'string') return send(response, 400, { error: 'Expected { source: string, base: string }' })
        const result = deckFile.write(body.source, body.base)
        if (result.ok) return send(response, 200, { hash: result.hash })
        return send(response, 409, { error: 'conflict', source: result.source, hash: result.hash })
      }
      if (['/deck', '/source'].includes(pathname)) { response.setHeader('Allow', pathname === '/deck' ? 'GET' : 'POST'); return send(response, 405, { error: 'Method not allowed' }) }
      return next()
    } catch (error) {
      if (error instanceof ManifestError) return send(response, 500, { error: error.message })
      return send(response, error.status ?? 500, { error: error.message })
    }
  }
}

export function editorPlugin(slidesPath) {
  const abs = resolve(slidesPath)
  const deckFile = createDeckFile(abs)
  return {
    name: 'vite-plugin-mdeck-editor',
    configureServer(server) {
      server.middlewares.use('/__mdeck', editorMiddleware(deckFile, { registryFor: () => loadRegistry(abs) }))
      server.watcher.add(abs)
      let timer
      const changed = file => {
        if (resolve(file) !== abs) return
        clearTimeout(timer)
        timer = setTimeout(() => {
          let content
          try { content = readFileSync(abs, 'utf8') } catch { return }
          if (deckFile.isExternalChange(content)) server.ws.send('mdeck:deck-changed', { hash: hashSource(content) })
        }, 75)
      }
      server.watcher.on('change', changed)
      server.watcher.on('add', changed)
    },
  }
}
