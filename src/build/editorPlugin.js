// Local editing API for `mdeck edit`. The server is a guarded file writer:
// it only ever writes the one deck path, rejects stale writes with the
// current content, and tells the editor when the file changed on disk.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, basename } from 'node:path'
import { loadRegistry, serializeRegistry } from '../extensions/discover.js'
import { ManifestError } from '../extensions/manifest.js'

const BODY_LIMIT = 32 * 1024 * 1024
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

export function hashSource(source) {
  return createHash('sha1').update(source, 'utf8').digest('hex')
}

export function createDeckFile(abs) {
  let lastWritten = null
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
      writeFileSync(abs, source, 'utf8')
      lastWritten = source
      return { ok: true, hash: hashSource(source) }
    },
    isExternalChange(content) { return content !== lastWritten },
  }
}

function hostname(host = '') {
  const match = host.match(/^(\[[^\]]*\]|[^:]+)(?::\d+)?$/)
  return match ? match[1].toLowerCase() : ''
}

// Browsers send Origin on cross-site requests; a page served by this server
// has the same host. Everything else is refused, and only loopback hosts are
// served at all.
export function isAllowedRequest(request) {
  const host = request.headers.host ?? ''
  if (!LOOPBACK.has(hostname(host))) return false
  const origin = request.headers.origin
  if (origin == null) return true
  try { return new URL(origin).host.toLowerCase() === host.toLowerCase() } catch { return false }
}

function send(response, status, body) {
  const text = JSON.stringify(body)
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(text), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  response.end(text)
}

function readJson(request) {
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

export function editorMiddleware(deckFile, { registryFor }) {
  return async (request, response, next) => {
    const pathname = new URL(request.url, 'http://localhost').pathname
    if (!isAllowedRequest(request)) return send(response, 403, { error: 'Requests are only accepted from this editor on this computer' })
    try {
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
