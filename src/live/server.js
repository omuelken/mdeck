// The room server for audience interaction, two ways: inside `mdeck dev`
// at /__mdeck/live, or on its own with `mdeck live` for hosted decks.
import { createServer } from 'node:http'
import { liveHandler, createRooms, keyMatches } from './rooms.js'
import { isAllowedRequest } from '../build/editorPlugin.js'

// In the dev server only the presenter's own browser, on this computer and on
// a page this server served, may reset rooms; phones in the network may answer.
export function livePlugin() {
  return {
    name: 'vite-plugin-mdeck-live',
    configureServer(server) {
      const handler = liveHandler({
        rooms: createRooms(),
        canReset: isAllowedRequest,
        info: () => ({ network: server.resolvedUrls?.network?.[0] ?? null }),
      })
      server.middlewares.use('/__mdeck/live', (request, response, next) => handler(request, response, next))
    },
  }
}

// Standalone: put it behind a web server (proxy /live/ to it) and give the
// deck `live: { server: https://…/live }`. Resetting a room needs the key.
export function startLiveServer({ port = 8787, host = '127.0.0.1', key = null } = {}) {
  const handler = liveHandler({ rooms: createRooms(), canReset: request => keyMatches(request, key) })
  const server = createServer((request, response) => handler(request, response))
  return new Promise((done, fail) => {
    server.once('error', fail)
    server.listen(port, host, () => done({ server, url: `http://${host.includes(':') ? `[${host}]` : host}:${server.address().port}`, close: () => new Promise(resolve => { server.closeAllConnections?.(); server.close(resolve) }) }))
  })
}
