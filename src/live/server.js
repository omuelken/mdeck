// The server for audience interaction, two ways: inside `mdeck run`
// at /__mdeck/live, or on its own with `mdeck server` for hosted decks.
import { createServer } from 'node:http'
import { liveHandler, createRooms, keyMatches } from './rooms.js'
import { isAllowedRequest } from '../build/editorPlugin.js'
import { createTunnels } from './tunnel.js'
import http from 'node:http'
import https from 'node:https'

// In the dev server only the presenter's own browser, on this computer and on
// a page this server served, or a paired device (src/build/pairing.js) may
// reset rooms; phones in the network may answer.
export function livePlugin({ pairing = null, upstream = null, key = null, session = () => null } = {}) {
  return {
    name: 'vite-plugin-mdeck-live',
    configureServer(server) {
      const handler = liveHandler({
        rooms: createRooms(),
        canReset: (request, room) => isAllowedRequest(request) || (!!pairing?.allows(request) && (room == null || room === session() || room.startsWith(`${session()}.`))),
        info: () => ({ network: server.resolvedUrls?.network?.[0] ?? null }),
      })
      server.middlewares.use('/__mdeck/live', (request, response, next) => {
        const address = typeof upstream === 'function' ? upstream() : upstream
        if (address && key) return controlProxy({ upstream: address, key, session, authorize: request => isAllowedRequest(request) || !!pairing?.allows(request) })(request, response)
        return handler(request, response, next)
      })
    },
  }
}

// Standalone: put it behind a web server (proxy / to it) and give the deck
// `server: https://…`. Resetting a room needs the key. With a key it
// is also the relay for `mdeck run --server` (src/live/tunnel.js), which needs
// the web server to pass WebSocket upgrades on.
export function startLiveServer({ port = 8787, host = '127.0.0.1', key = null } = {}) {
  const tunnels = createTunnels({ key })
  const handler = liveHandler({ rooms: createRooms(), canReset: (request, room) => keyMatches(request, key) || tunnels.allows(request, room) })
  const server = createServer((request, response) => { if (!tunnels.handleRequest(request, response)) handler(request, response) })
  server.on('upgrade', (request, socket, head) => { if (!tunnels.handleUpgrade(request, socket, head)) socket.destroy() })
  return new Promise((done, fail) => {
    server.once('error', fail)
    server.listen(port, host, () => done({ server, tunnels, url: `http://${host.includes(':') ? `[${host}]` : host}:${server.address().port}`, close: () => new Promise(resolve => { tunnels.close(); server.closeAllConnections?.(); server.close(resolve) }) }))
  })
}

// Network pairing with a standalone room server keeps its master key on the
// presenter's computer. Devices send their revocable token to this proxy.
export function controlProxy({ upstream, key, session, authorize }) {
  return (request, response) => {
    const url = new URL(request.url, 'http://localhost')
    let room
    try { room = decodeURIComponent(url.pathname.match(/^\/rooms\/([^/]+)(?:\/(?:events|presence|reset|state|ink))?$/)?.[1] ?? '') } catch {}
    const code = session()
    const scoped = room === code || room?.startsWith(`${code}.`)
    const allowed = authorize(request)
    if ((url.pathname !== '/info' && !scoped) || (url.pathname === '/info' && url.searchParams.has('session') && url.searchParams.get('session') !== code) || (request.method === 'POST' && !allowed) || !['GET', 'POST', 'OPTIONS'].includes(request.method)) {
      response.writeHead(403, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ error: 'This device cannot control that room' })); return
    }
    const target = new URL(`${upstream.replace(/\/+$/, '')}${url.pathname}${url.search}`)
    const headers = { 'Content-Type': request.headers['content-type'] ?? 'application/json', ...(allowed ? { Authorization: `Bearer ${key}` } : {}) }
    const forward = (target.protocol === 'https:' ? https : http).request(target, { method: request.method, headers }, result => {
      response.writeHead(result.statusCode, { ...result.headers, 'referrer-policy': 'no-referrer' })
      result.pipe(response)
    })
    forward.on('error', () => { if (!response.headersSent) response.writeHead(502); response.end() })
    response.on('close', () => forward.destroy())
    request.pipe(forward)
  }
}
