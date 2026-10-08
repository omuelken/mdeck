// Keeping the answers while `mdeck run` runs: the presenter's screens send
// each activity's answers as they come in (src/live/client.js), and they go
// into <deck>.results.json beside the deck (src/core/results.js).
//
//   POST /__mdeck/results   { room, closed, answers } → { ok }
//
// Answers of none take the room out of the file, as Reset does. Writes wait
// a moment, so a burst of votes is one write, and do not reload the open
// windows (ownWrites.js).
import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { resolve } from 'node:path'
import { resultsFileFor, normalizeResults, withRoom, serializeResults } from '../core/results.js'
import { isAllowedRequest, send, readJson } from './editorPlugin.js'
import { markOwnWrite } from './ownWrites.js'

export function createResultsFile(deckPath, { debounceMs = 500 } = {}) {
  const path = resultsFileFor(resolve(deckPath))
  let results = null, timer = null

  const current = () => {
    if (results) return results
    try { results = existsSync(path) ? normalizeResults(JSON.parse(readFileSync(path, 'utf8'))) : normalizeResults({}) }
    catch { results = normalizeResults({}) }
    return results
  }

  function flush() {
    clearTimeout(timer)
    timer = null
    if (!results) return
    // A deck that never kept answers gets no empty file.
    if (!Object.keys(results.rooms).length && !existsSync(path)) return
    const text = serializeResults(results)
    markOwnWrite(path, text)
    const temp = `${path}.${process.pid}.tmp`
    writeFileSync(temp, text, 'utf8')
    renameSync(temp, path)
  }

  return {
    path,
    read: current,
    save(room, entry) {
      results = withRoom(current(), room, entry)
      clearTimeout(timer)
      timer = setTimeout(flush, debounceMs)
    },
    flush,
  }
}

export function resultsMiddleware(file, { authorize = isAllowedRequest } = {}) {
  return async (request, response, next) => {
    const { pathname } = new URL(request.url, 'http://localhost')
    if (pathname !== '/') return next()
    if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); return send(response, 405, { error: 'Method not allowed' }) }
    if (!authorize(request)) return send(response, 403, { error: 'Only the presenter keeps the results' })
    try {
      const { room, closed, answers } = await readJson(request)
      file.save(String(room ?? ''), { closed, answers })
      return send(response, 200, { ok: true })
    } catch (error) {
      return send(response, error.status ?? 500, { error: error.message })
    }
  }
}

export function resultsPlugin(slidesPath, { authorize } = {}) {
  return {
    name: 'vite-plugin-mdeck-results',
    configureServer(server) {
      const file = createResultsFile(slidesPath)
      server.middlewares.use('/__mdeck/results', resultsMiddleware(file, { authorize }))
      server.httpServer?.once('close', () => file.flush())
    },
  }
}
