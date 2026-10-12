// Saving a rehearsal's times while `mdeck run` runs: the presenter view
// sends each slide's new time, and it goes into the slide's settings as
// `time: 1m30s` (core/timing.js). null takes a slide's time out.
//
//   GET  /__mdeck/timing   → { ids }
//   POST /__mdeck/timing   { ids, times: { [slideId]: '1m30s' | null } } → { ok, changed }
//
// Slides without an `id:` are named by position (slide-3), so the times are
// only written when the deck still has the slides the page saw (`ids`);
// otherwise the answer is 409. The deck is copied to .mdeck-backups/ before
// the first write, and the write does not reload the open windows
// (ownWrites.js).
import { readFileSync, writeFileSync, renameSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseSlides } from '../core/parseSlides.js'
import { setSlideMeta } from '../core/editDeck.js'
import { parseTime, formatTime } from '../core/timing.js'
import { isAllowedRequest, send, readJson, backupDeck } from './editorPlugin.js'
import { markOwnWrite } from './ownWrites.js'

export function createTimingFile(deckPath) {
  const abs = resolve(deckPath)
  let backedUp = false
  const read = () => { const source = readFileSync(abs, 'utf8'); return { source, deck: parseSlides(source) } }

  return {
    path: abs,
    ids: () => read().deck.slides.map(slide => slide.id),
    save(ids, times) {
      let { source, deck } = read()
      const current = deck.slides.map(slide => slide.id)
      if (!Array.isArray(ids) || ids.join('\n') !== current.join('\n')) return { status: 409, error: 'The deck changed since the rehearsal began; rehearse again', ids: current }
      const before = source
      let changed = 0
      for (const [id, value] of Object.entries(times ?? {})) {
        if (!current.includes(id)) return { status: 400, error: `No slide "${id}" in the deck` }
        const seconds = value == null ? null : parseTime(value)
        if (value != null && seconds == null) return { status: 400, error: `"${value}" is not a time` }
        const time = seconds == null ? undefined : formatTime(seconds)
        if (deck.slides.find(slide => slide.id === id).meta.time === time) continue
        source = setSlideMeta(deck, id, { time })
        deck = parseSlides(source)
        changed++
      }
      if (source === before) return { status: 200, ok: true, changed: 0 }
      if (!backedUp) { backupDeck(abs, before); backedUp = true }
      markOwnWrite(abs, source)
      const temp = `${abs}.${process.pid}.tmp`
      writeFileSync(temp, source, 'utf8')
      renameSync(temp, abs)
      return { status: 200, ok: true, changed }
    },
  }
}

export function timingMiddleware(file, { authorize = isAllowedRequest } = {}) {
  return async (request, response, next) => {
    const { pathname } = new URL(request.url, 'http://localhost')
    if (pathname !== '/') return next()
    if (!authorize(request)) return send(response, 403, { error: 'Only the presenter can save times' })
    try {
      if (request.method === 'GET') return send(response, 200, { ids: file.ids() })
      if (request.method !== 'POST') { response.setHeader('Allow', 'GET, POST'); return send(response, 405, { error: 'Method not allowed' }) }
      const { ids, times } = await readJson(request)
      const { status, ...result } = file.save(ids, times)
      return send(response, status, result)
    } catch (error) {
      return send(response, error.status ?? 500, { error: error.message })
    }
  }
}

export function timingPlugin(slidesPath, { authorize } = {}) {
  return {
    name: 'vite-plugin-mdeck-timing',
    configureServer(server) {
      server.middlewares.use('/__mdeck/timing', timingMiddleware(createTimingFile(slidesPath), { authorize }))
    },
  }
}
