// Rooms for audience interaction. A room is a list of small messages that
// phones post and slides follow live; the server never interprets them, so a
// new kind of activity (poll, word cloud, questions) needs no server change.
// A room also has one state value that only the presenter sets; the deck uses
// it to tell phones which activity is on screen.
// Everything lives in memory: nothing is written to disk, and idle rooms are
// forgotten. The same handler runs inside `mdeck dev` and as `mdeck live`.
import { timingSafeEqual } from 'node:crypto'

export const ROOM_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/
const HOUR = 60 * 60 * 1000

export function createRooms({ maxMessages = 5000, maxRooms = 500, idleMs = 12 * HOUR, now = Date.now } = {}) {
  const rooms = new Map()
  const prune = () => { for (const [id, room] of rooms) if (!room.listeners.size && now() - room.touched > idleMs) rooms.delete(id) }
  const get = id => {
    let room = rooms.get(id)
    if (!room) {
      if (rooms.size >= maxRooms) prune()
      if (rooms.size >= maxRooms) throw Object.assign(new Error('Too many rooms are open on this server'), { status: 503 })
      room = { messages: [], state: null, listeners: new Set(), next: 1, touched: now() }
      rooms.set(id, room)
    }
    room.touched = now()
    return room
  }
  const broadcast = (room, event) => { for (const listener of room.listeners) listener(event) }
  return {
    post(id, { from = null, data }) {
      const room = get(id)
      if (room.messages.length >= maxMessages) throw Object.assign(new Error('This room is full'), { status: 429 })
      const message = { n: room.next++, at: new Date(now()).toISOString(), from, data }
      room.messages.push(message)
      broadcast(room, { type: 'message', message })
      return message
    },
    reset(id) {
      const room = get(id)
      room.messages = []
      broadcast(room, { type: 'reset' })
    },
    setState(id, state) {
      const room = get(id)
      room.state = state ?? null
      broadcast(room, { type: 'state', state: room.state })
    },
    snapshot: id => get(id).messages,
    state: id => get(id).state,
    subscribe(id, listener) {
      const room = get(id)
      room.listeners.add(listener)
      return () => { room.listeners.delete(listener); room.touched = now() }
    },
    get size() { return rooms.size },
  }
}

// Per-address token bucket: `burst` messages at once, refilled over `perMs`.
export function createLimiter({ burst = 30, perMs = 10000, now = Date.now } = {}) {
  const buckets = new Map()
  return key => {
    const t = now()
    const bucket = buckets.get(key) ?? { tokens: burst, at: t }
    bucket.tokens = Math.min(burst, bucket.tokens + ((t - bucket.at) / perMs) * burst)
    bucket.at = t
    buckets.set(key, bucket)
    if (buckets.size > 10000) for (const [k, b] of buckets) if (b.tokens >= burst) buckets.delete(k)
    if (bucket.tokens < 1) return false
    bucket.tokens -= 1
    return true
  }
}

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])
export const isLoopbackAddress = address => LOOPBACK.has(address)

// Behind a proxy on the same machine (nginx), the client is the forwarded one.
export function clientAddress(request) {
  const direct = request.socket?.remoteAddress ?? ''
  const forwarded = request.headers['x-forwarded-for']
  return isLoopbackAddress(direct) && forwarded ? forwarded.split(',')[0].trim() : direct
}

export function keyMatches(request, key) {
  if (!key) return false
  const given = Buffer.from((request.headers.authorization ?? '').replace(/^Bearer\s+/i, ''))
  const wanted = Buffer.from(key)
  return given.length === wanted.length && timingSafeEqual(given, wanted)
}

const MAX_BODY = 4096

function readBody(request) {
  return new Promise((done, fail) => {
    if (!/^application\/json\b/i.test(request.headers['content-type'] ?? '')) return fail(Object.assign(new Error('Send JSON'), { status: 415 }))
    let size = 0
    const chunks = []
    request.on('data', chunk => {
      size += chunk.length
      if (size > MAX_BODY) { request.pause(); fail(Object.assign(new Error('Message too large'), { status: 413, close: true })); return }
      chunks.push(chunk)
    })
    request.on('end', () => { try { done(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')) } catch { fail(Object.assign(new Error('Not valid JSON'), { status: 400 })) } })
    request.on('error', fail)
  })
}

function reply(response, status, body) {
  const text = JSON.stringify(body)
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  response.end(text)
}

// Routes, relative to where the handler is mounted:
//   GET  /info                 { canReset, ...extra }
//   GET  /rooms/<id>/events    Server-Sent Events: snapshot, message, reset, state
//   POST /rooms/<id>           { from, data } → { n }
//   POST /rooms/<id>/reset     presenter only
//   POST /rooms/<id>/state     { state } — presenter only
// Answers carry no cookies and no personal data, so any page may use them.
export function liveHandler({ rooms = createRooms(), canReset = () => false, info = () => ({}), limit = createLimiter(), heartbeatMs = 20000 } = {}) {
  return async (request, response, next = () => reply(response, 404, { error: 'Not found' })) => {
    const { pathname } = new URL(request.url, 'http://localhost')
    response.setHeader('Access-Control-Allow-Origin', '*')
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return }
    try {
      if (pathname === '/info' && request.method === 'GET') return reply(response, 200, { canReset: !!canReset(request), ...info(request) })
      const match = pathname.match(/^\/rooms\/([^/]+)(\/events|\/reset|\/state)?$/)
      if (!match) return next()
      const id = decodeURIComponent(match[1])
      if (!ROOM_RE.test(id)) return reply(response, 400, { error: 'Room names use letters, digits, dots, hyphens and underscores' })
      if (match[2] === '/events' && request.method === 'GET') {
        response.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' })
        const write = (event, data) => response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        write('snapshot', { messages: rooms.snapshot(id), state: rooms.state(id) })
        const unsubscribe = rooms.subscribe(id, event => write(event.type, event.type === 'message' ? event.message : event.type === 'state' ? { state: event.state } : {}))
        const beat = setInterval(() => response.write(': ping\n\n'), heartbeatMs)
        request.on('close', () => { clearInterval(beat); unsubscribe() })
        return
      }
      if (request.method !== 'POST') return reply(response, 405, { error: 'Method not allowed' })
      if (match[2] === '/reset' || match[2] === '/state') {
        if (!canReset(request)) return reply(response, 403, { error: 'Only the presenter can change a room' })
        if (match[2] === '/reset') rooms.reset(id)
        else rooms.setState(id, (await readBody(request)).state)
        return reply(response, 200, { ok: true })
      }
      if (!limit(clientAddress(request))) return reply(response, 429, { error: 'Too many answers at once; wait a moment' })
      const body = await readBody(request)
      if (!('data' in body)) return reply(response, 400, { error: 'Send { data }' })
      const from = typeof body.from === 'string' ? body.from.slice(0, 64) : null
      return reply(response, 201, { n: rooms.post(id, { from, data: body.data }).n })
    } catch (error) {
      // An oversized body is not read to the end; answer, then drop the connection.
      if (error.close) { response.setHeader('Connection', 'close'); response.on('finish', () => request.destroy()) }
      if (!response.headersSent) reply(response, error.status ?? 500, { error: error.message })
    }
  }
}
