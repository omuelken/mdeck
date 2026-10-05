// The server for audience interaction, two ways: inside `mdeck run`
// at /__mdeck/live, or on its own with `mdeck server` for hosted decks.
import { createServer } from 'node:http'
import { liveHandler, createRooms, keyMatches } from './rooms.js'
import { isAllowedRequest } from '../build/editorPlugin.js'
import { createTunnels } from './tunnel.js'

// In the dev server only the presenter's own browser, on this computer and on
// a page this server served, or a paired device (src/build/pairing.js) may
// reset rooms; phones in the network may answer.
export function livePlugin({ pairing = null } = {}) {
  return {
    name: 'vite-plugin-mdeck-live',
    configureServer(server) {
      const handler = liveHandler({
        rooms: createRooms(),
        canReset: request => isAllowedRequest(request) || !!pairing?.allows(request),
        info: () => ({ network: server.resolvedUrls?.network?.[0] ?? null }),
      })
      server.middlewares.use('/__mdeck/live', (request, response, next) => handler(request, response, next))
    },
  }
}

// Standalone: put it behind a web server (proxy / to it) and give the deck
// `server: https://…`. Resetting a room needs the key. With a key it
// is also the relay for `mdeck run --server` (src/live/tunnel.js), which needs
// the web server to pass WebSocket upgrades on.
export function startLiveServer({ port = 8787, host = '127.0.0.1', key = null } = {}) {
  const tunnels = createTunnels({ key })
  const handler = liveHandler({ rooms: createRooms(), canReset: request => keyMatches(request, key) || tunnels.allows(request) })
  const server = createServer((request, response) => { if (!tunnels.handleRequest(request, response)) handler(request, response) })
  server.on('upgrade', (request, socket, head) => { if (!tunnels.handleUpgrade(request, socket, head)) socket.destroy() })
  return new Promise((done, fail) => {
    server.once('error', fail)
    server.listen(port, host, () => done({ server, tunnels, url: `http://${host.includes(':') ? `[${host}]` : host}:${server.address().port}`, close: () => new Promise(resolve => { tunnels.close(); server.closeAllConnections?.(); server.close(resolve) }) }))
  })
}
