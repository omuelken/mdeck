// Decks published to a standalone server: `mdeck publish` uploads one
// self-contained HTML file (the reader build, without notes), and the server
// hands it out at /d/<name>. They live in a folder on disk, one file each;
// publishing needs the server's key, reading needs only the link.
import { linkSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { keyMatches } from './rooms.js'

export const DECK_NAME_RE = /^[a-z0-9][a-z0-9-]{0,62}$/
const MAX_DECK_BYTES = 64 * 1024 * 1024

const json = (response, status, body) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  response.end(JSON.stringify(body))
}

/**
 * Routes for published decks: returns a function that answers a request and
 * says whether it was one of them. `guard` counts wrong keys like the rooms do.
 */
export function deckRoutes({ dir, key, guard, maxBytes = MAX_DECK_BYTES }) {
  mkdirSync(dir, { recursive: true })
  // A crash between writing and renaming leaves a temporary file behind.
  for (const file of readdirSync(dir)) if (file.endsWith('.tmp')) rmSync(join(dir, file), { force: true })
  const fileOf = name => join(dir, `${name}.html`)
  const authorized = (request, response) => {
    if (guard?.blocked(request)) { json(response, 429, { error: 'Too many wrong keys; wait a minute' }); return false }
    if (keyMatches(request, key)) return true
    guard?.failed(request)
    json(response, 401, { error: 'The key is wrong' })
    return false
  }

  return (request, response) => {
    const { pathname } = new URL(request.url, 'http://localhost')
    const view = pathname.match(/^\/d\/([^/]+)$/)
    if (view && (request.method === 'GET' || request.method === 'HEAD')) {
      let html
      try { html = DECK_NAME_RE.test(view[1]) ? readFileSync(fileOf(view[1])) : null } catch {}
      if (!html) { json(response, 404, { error: 'No such deck' }); return true }
      // The deck is its own page; nothing it links to should learn where it was opened from.
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': html.length, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex' })
      response.end(request.method === 'HEAD' ? undefined : html)
      return true
    }

    const manage = pathname.match(/^\/decks(?:\/([^/]+))?$/)
    if (!manage) return false
    if (!key) { json(response, 404, { error: 'Publishing is off: this server has no key' }); return true }
    const name = manage[1]
    if (name !== undefined && !DECK_NAME_RE.test(name)) { json(response, 400, { error: 'A deck name has lowercase letters, digits and hyphens, and starts with a letter or digit (at most 63)' }); return true }

    if (request.method === 'GET' && name === undefined) {
      if (!authorized(request, response)) return true
      const decks = []
      try {
        for (const file of readdirSync(dir)) {
          if (!file.endsWith('.html')) continue
          // A deck removed while listing is simply not listed.
          try { const stat = statSync(join(dir, file)); decks.push({ name: file.slice(0, -5), bytes: stat.size, updated: stat.mtime.toISOString() }) } catch {}
        }
      } catch { json(response, 500, { error: 'The server could not read its decks folder' }); return true }
      json(response, 200, { decks })
      return true
    }
    if (name === undefined) { json(response, 405, { error: 'Use GET' }); return true }

    if (request.method === 'DELETE') {
      if (!authorized(request, response)) return true
      try { rmSync(fileOf(name)) } catch { json(response, 404, { error: 'No such deck' }); return true }
      json(response, 200, { removed: name })
      return true
    }
    if (request.method === 'PUT') {
      if (!authorized(request, response)) return true
      // An existing deck is only replaced when the sender says so.
      let existing = null
      try { existing = statSync(fileOf(name)) } catch {}
      if (existing && request.headers['x-mdeck-replace'] !== '1') { json(response, 409, { error: `${name} already exists`, exists: true, bytes: existing.size, updated: existing.mtime.toISOString() }); request.resume(); return true }
      if (Number(request.headers['content-length']) > maxBytes) { json(response, 413, { error: `A deck may be at most ${Math.round(maxBytes / 1048576)} MB` }); request.resume(); return true }
      const chunks = []
      let size = 0, refused = false
      request.on('data', chunk => {
        size += chunk.length
        if (refused) return
        if (size > maxBytes) {
          // Answer first, then drop the connection: a destroyed socket could not carry the 413.
          refused = true; chunks.length = 0
          response.setHeader('Connection', 'close')
          json(response, 413, { error: `A deck may be at most ${Math.round(maxBytes / 1048576)} MB` })
          response.once('finish', () => request.destroy())
          return
        }
        chunks.push(chunk)
      })
      request.on('end', () => {
        if (refused) return
        const body = Buffer.concat(chunks)
        if (!/<html[\s>]/i.test(body.subarray(0, 4096).toString('utf8'))) { json(response, 400, { error: 'That is not an HTML page' }); return }
        const temporary = `${fileOf(name)}.${randomBytes(4).toString('hex')}.tmp`
        const replacing = request.headers['x-mdeck-replace'] === '1'
        try {
          writeFileSync(temporary, body)
          // Without --replace the name is claimed atomically, so two uploads cannot both win.
          if (replacing) renameSync(temporary, fileOf(name))
          else { linkSync(temporary, fileOf(name)); rmSync(temporary) }
        } catch (error) {
          rmSync(temporary, { force: true })
          if (error.code === 'EEXIST') { let taken = existing; try { taken = statSync(fileOf(name)) } catch {} json(response, 409, { error: `${name} already exists`, exists: true, bytes: taken?.size ?? 0, updated: (taken?.mtime ?? new Date()).toISOString() }); return }
          json(response, 500, { error: 'The server could not store the deck' }); return
        }
        json(response, 200, { name, path: `/d/${name}`, bytes: body.length, replaced: !!existing })
      })
      return true
    }
    json(response, 405, { error: 'Use GET, PUT or DELETE' })
    return true
  }
}
