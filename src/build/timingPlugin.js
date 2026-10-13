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
// (ownWrites.js). A slide from another file the deck includes (include.js)
// gets its time in that file, as that file's own slide.
import { readFileSync, writeFileSync, renameSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseSlides } from '../core/parseSlides.js'
import { setSlideMeta } from '../core/editDeck.js'
import { parseTime, formatTime } from '../core/timing.js'
import { isAllowedRequest, send, readJson, backupDeck } from './editorPlugin.js'
import { markOwnWrite } from './ownWrites.js'
import { expandDeck } from './include.js'

export function createTimingFile(deckPath) {
  const abs = resolve(deckPath)
  const backedUp = new Set()
  // The deck as shown, and for each slide the file it is written in.
  const shown = () => {
    const { source, origins } = expandDeck(abs)
    return { deck: parseSlides(source), origins }
  }

  return {
    path: abs,
    ids: () => shown().deck.slides.map(slide => slide.id),
    save(ids, times) {
      const { deck: whole, origins } = shown()
      const current = whole.slides.map(slide => slide.id)
      if (!Array.isArray(ids) || ids.join('\n') !== current.join('\n')) return { status: 409, error: 'The deck changed since the rehearsal began; rehearse again', ids: current }
      // The new times, by the file the slide is written in and its id there.
      const files = new Map()
      for (const [id, value] of Object.entries(times ?? {})) {
        if (!current.includes(id)) return { status: 400, error: `No slide "${id}" in the deck` }
        const seconds = value == null ? null : parseTime(value)
        if (value != null && seconds == null) return { status: 400, error: `"${value}" is not a time` }
        const time = seconds == null ? undefined : formatTime(seconds)
        if (whole.slides.find(slide => slide.id === id).meta.time === time) continue
        const { file, id: own } = origins?.[id] ?? { file: abs, id }
        if (!files.has(file)) files.set(file, [])
        files.get(file).push([own, time])
      }
      let changed = 0
      for (const [file, entries] of files) {
        const before = readFileSync(file, 'utf8')
        let source = before, deck = parseSlides(source)
        for (const [id, time] of entries) {
          source = setSlideMeta(deck, id, { time })
          deck = parseSlides(source)
          changed++
        }
        if (source === before) continue
        if (!backedUp.has(file)) { backupDeck(file, before); backedUp.add(file) }
        markOwnWrite(file, source)
        const temp = `${file}.${process.pid}.tmp`
        writeFileSync(temp, source, 'utf8')
        renameSync(temp, file)
      }
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
