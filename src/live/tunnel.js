// The server as a relay for `mdeck run --server`. The presenter's computer
// opens one outbound WebSocket to /tunnel/<id>, authenticated with the room
// server's key. A browser, such as an iPad, then opens /t/<id>/… on this
// server; each request is passed down that connection to the computer, which
// answers it from its own dev server, and the answer is passed back. The
// slides are never stored here, and the computer needs no open port.
//
// Messages are JSON text frames, bodies are base64 in chunks:
//   server → computer   req {id, method, path, headers, body?}   abort {id}
//                       wsopen {id, path, protocols}   wsmsg {id, b, bin}   wsclose {id, code}
//   computer → server   head {id, status, headers}   data {id, b}   end {id}   err {id, status, message}
//                       tokens {tokens}   wsmsg {id, b, bin}   wsclose {id, code}
// `tokens` are the computer's paired devices: while the tunnel is open they
// may steer rooms here like the key does.
import { timingSafeEqual } from 'node:crypto'
import { WebSocketServer } from 'ws'
import { keyMatches } from './rooms.js'

export const TUNNEL_ID_RE = /^[A-Za-z0-9_-]{16,64}$/
const ROUTE_RE = /^\/t\/([A-Za-z0-9_-]{16,64})(\/.*)?$/
const MB = 1024 * 1024
// Hop-by-hop headers are not passed on, and neither are the ones the two ends
// decide for themselves.
const HOP = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'proxy-connection', 'te', 'trailer', 'transfer-encoding', 'upgrade'])
const NOT_REQUEST = new Set([...HOP, 'host', 'accept-encoding', 'content-length', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'x-real-ip', 'x-mdeck-tunnel', 'cookie'])
const NOT_RESPONSE = new Set([...HOP, 'content-length', 'content-encoding'])
const same = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y) }

function forward(headers, skip) {
  const out = {}
  for (const [name, value] of Object.entries(headers)) if (!skip.has(name.toLowerCase())) out[name.toLowerCase()] = value
  return out
}

function text(response, status, message) {
  if (response.headersSent) return response.end()
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' })
  response.end(message)
}

export function createTunnels({ key = null, bodyLimit = 2 * MB, maxTunnels = 50, maxPending = 128, requestTimeoutMs = 60000, pingMs = 25000 } = {}) {
  const tunnels = new Map()
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 16 * MB, handleProtocols: protocols => [...protocols][0] ?? false })

  function open(id, socket) {
    tunnels.get(id)?.socket.close(4000, 'Replaced by a newer connection')
    const tunnel = { socket, pending: new Map(), peers: new Map(), tokens: new Set(), session: null, next: 1, alive: true }
    tunnels.set(id, tunnel)
    const send = message => { if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message)) }
    tunnel.send = send
    socket.on('pong', () => { tunnel.alive = true })
    const beat = setInterval(() => {
      if (!tunnel.alive) return socket.terminate()
      tunnel.alive = false
      socket.ping()
    }, pingMs)
    socket.on('message', raw => {
      let message
      try { message = JSON.parse(raw.toString()) } catch { return }
      if (!message || typeof message !== 'object') return
      const pending = tunnel.pending.get(message.id)
      switch (message.t) {
        case 'head':
          if (pending && !pending.headersSent) pending.writeHead(Number(message.status) || 502, { ...forward(message.headers ?? {}, NOT_RESPONSE), 'referrer-policy': 'no-referrer' })
          break
        case 'data':
          if (pending && typeof message.b === 'string') pending.write(Buffer.from(message.b, 'base64'))
          break
        case 'end':
          if (pending) { pending.end(); tunnel.pending.delete(message.id) }
          break
        case 'err':
          if (pending) { text(pending, Number(message.status) || 502, String(message.message ?? 'The presenter\'s computer could not answer')); tunnel.pending.delete(message.id) }
          break
        case 'tokens':
          tunnel.session = /^\d{4,8}$/.test(message.session ?? '') ? String(message.session) : null
          tunnel.tokens = new Set((Array.isArray(message.tokens) ? message.tokens : []).filter(token => typeof token === 'string' && token.length >= 16 && token.length <= 200).slice(0, 50))
          break
        case 'wsmsg': {
          const peer = tunnel.peers.get(message.id)
          if (peer && typeof message.b === 'string') peer.send(message.bin ? Buffer.from(message.b, 'base64') : Buffer.from(message.b, 'base64').toString('utf8'))
          break
        }
        case 'wsclose': {
          const peer = tunnel.peers.get(message.id)
          if (peer) { tunnel.peers.delete(message.id); peer.close(Number.isInteger(message.code) && message.code >= 1000 && message.code < 5000 && ![1004, 1005, 1006, 1015].includes(message.code) ? message.code : 1011) }
          break
        }
      }
    })
    socket.on('close', () => {
      clearInterval(beat)
      for (const response of tunnel.pending.values()) text(response, 502, 'The presenter\'s computer went away')
      for (const peer of tunnel.peers.values()) peer.close(1001)
      if (tunnels.get(id) === tunnel) tunnels.delete(id)
    })
  }

  return {
    /** Whether the request carries the token of a device paired through an open tunnel. */
    allows(request, room = null) {
      const given = (request.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
      if (!given) return false
      for (const tunnel of tunnels.values()) {
        if (!tunnel.session || (room !== null && room !== tunnel.session && !room.startsWith(`${tunnel.session}.`))) continue
        for (const token of tunnel.tokens) if (same(token, given)) return true
      }
      return false
    },

    get size() { return tunnels.size },

    /** A browser's request for /t/<id>/…; false when the path is not a tunnel's. */
    handleRequest(request, response) {
      const match = new URL(request.url, 'http://localhost').pathname.match(ROUTE_RE)
      if (!match) return false
      if (!key) { text(response, 404, 'Not found'); return true }
      const tunnel = tunnels.get(match[1])
      if (!tunnel) { text(response, 404, 'This presentation is not shared right now. Start it again with mdeck run --server.'); return true }
      if (tunnel.pending.size >= maxPending) { text(response, 503, 'Too many requests at once'); return true }
      const id = tunnel.next++
      const chunks = []
      let size = 0
      let over = false
      request.on('data', chunk => {
        size += chunk.length
        if (size > bodyLimit) { over = true; return }
        chunks.push(chunk)
      })
      request.on('end', () => {
        if (over) return text(response, 413, 'Request body too large')
        if (tunnel.socket.readyState !== tunnel.socket.OPEN) return text(response, 502, 'The presenter\'s computer went away')
        tunnel.pending.set(id, response)
        const timer = setTimeout(() => { if (!response.headersSent) { text(response, 504, 'The presenter\'s computer did not answer in time'); tunnel.pending.delete(id); tunnel.send({ t: 'abort', id }) } }, requestTimeoutMs)
        response.on('close', () => {
          clearTimeout(timer)
          if (tunnel.pending.delete(id)) tunnel.send({ t: 'abort', id })
        })
        response.on('finish', () => clearTimeout(timer))
        tunnel.send({ t: 'req', id, method: request.method, path: request.url, headers: forward(request.headers, NOT_REQUEST), ...(chunks.length ? { body: Buffer.concat(chunks).toString('base64') } : {}) })
      })
      request.on('error', () => {})
      return true
    },

    /** An upgrade: the computer's /tunnel/<id>, or a browser's WebSocket to /t/<id>/…. False when not ours. */
    handleUpgrade(request, socket, head) {
      const { pathname } = new URL(request.url, 'http://localhost')
      const refuse = (status, reason) => { socket.write(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`); socket.destroy() }
      const own = pathname.match(/^\/tunnel\/([A-Za-z0-9_-]{16,64})$/)
      if (own) {
        if (!key) { refuse(404, 'Not Found'); return true }
        if (!keyMatches(request, key)) { refuse(401, 'Unauthorized'); return true }
        if (!tunnels.has(own[1]) && tunnels.size >= maxTunnels) { refuse(503, 'Service Unavailable'); return true }
        sockets.handleUpgrade(request, socket, head, ws => open(own[1], ws))
        return true
      }
      const match = pathname.match(ROUTE_RE)
      if (!match) return false
      const tunnel = key ? tunnels.get(match[1]) : null
      if (!tunnel) { refuse(404, 'Not Found'); return true }
      const protocols = String(request.headers['sec-websocket-protocol'] ?? '').split(',').map(item => item.trim()).filter(Boolean)
      sockets.handleUpgrade(request, socket, head, ws => {
        const id = tunnel.next++
        tunnel.peers.set(id, ws)
        tunnel.send({ t: 'wsopen', id, path: request.url, protocols })
        ws.on('message', (data, bin) => tunnel.send({ t: 'wsmsg', id, b: Buffer.from(data).toString('base64'), bin }))
        ws.on('close', code => { if (tunnel.peers.delete(id)) tunnel.send({ t: 'wsclose', id, code }) })
        ws.on('error', () => {})
      })
      return true
    },

    close() {
      for (const tunnel of tunnels.values()) tunnel.socket.close(1001)
      for (const client of sockets.clients) client.terminate()
      sockets.close()
    },
  }
}
