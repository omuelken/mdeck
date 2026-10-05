// Saving ink while `mdeck run` runs: the file beside the deck is the source of
// truth, and devices send changes as operations (see applyOp in core/ink.js),
// so strokes drawn on two devices at once never overwrite each other.
//
//   GET  /__mdeck/ink        { ink, deckHash }
//   POST /__mdeck/ink/ops    { deckHash, ops } → { deckHash, renamed }
//
// A slide that gets ink but has no `id:` of its own gets one, written into
// its settings, so the ink stays with it when slides are inserted. Ids by
// position (slide-3) are only trusted when the device saw the current deck
// (deckHash); otherwise the answer is 409 and the device reloads. The server's
// own writes do not reload the open windows (ownWrites.js); instead it sends
// `mdeck:ink`, and the pages fetch the ink again.
import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { parseSlides } from '../core/parseSlides.js'
import { setSlideMeta } from '../core/editDeck.js'
import { slideTitle } from '../core/outline.js'
import { slug } from '../live/code.js'
import { inkFileFor, normalizeInk, emptyInk, applyOp, serializeInk } from '../core/ink.js'
import { hashSource, isAllowedRequest, send, readJson, BACKUP_DIR } from './editorPlugin.js'
import { markOwnWrite } from './ownWrites.js'

const ID_RE = /^[a-zA-Z][a-zA-Z0-9_-]*$/
const BACKUPS_KEPT = 10

function writeAtomic(path, text) {
  const temp = `${path}.${process.pid}.tmp`
  writeFileSync(temp, text, 'utf8')
  renameSync(temp, path)
}

// A readable, unique id from the slide's heading, as ids must start with a letter.
function newSlideId(deck, slide, index) {
  const taken = new Set(deck.slides.map(s => s.id))
  let base = slug(slideTitle(slide, index, null)) || 'slide'
  if (!/^[a-z]/.test(base)) base = `slide-${base}`
  let id = base, n = 2
  while (taken.has(id) || !ID_RE.test(id)) id = `${base}-${n++}`
  return id
}

export function createInkFile(deckPath, { debounceMs = 300, onChange = () => {} } = {}) {
  const abs = resolve(deckPath)
  const inkPath = inkFileFor(abs)
  let ink = null, timer = null, backedUp = false
  // Ids given to slides, for devices that still saw the deck from before:
  // { from, to, before } applies only to requests made against `before`.
  const renames = []
  let knownIds = null

  const readDeck = () => { const source = readFileSync(abs, 'utf8'); return { source, deck: parseSlides(source), hash: hashSource(source) } }
  const size = deck => ({ width: deck.deckConfig?.width ?? 1920, height: deck.deckConfig?.height ?? 1080 })

  // The file on disk, unless changes are still waiting to be written.
  function current(deck) {
    if (timer && ink) return ink
    try { ink = existsSync(inkPath) ? normalizeInk(JSON.parse(readFileSync(inkPath, 'utf8')), size(deck)) : emptyInk(size(deck)) }
    catch { ink ??= emptyInk(size(deck)) }
    return ink
  }

  function backupOnce() {
    if (backedUp || !existsSync(inkPath)) { backedUp = true; return }
    const dir = resolve(dirname(abs), BACKUP_DIR)
    mkdirSync(dir, { recursive: true })
    const name = basename(inkPath, '.json')
    writeFileSync(resolve(dir, `${name}-${new Date().toISOString().replace(/[:.]/g, '-').replace(/-\d{3}Z$/, 'Z')}.json`), readFileSync(inkPath))
    const copies = readdirSync(dir).filter(entry => entry.startsWith(`${name}-`) && entry.endsWith('.json')).sort()
    for (const old of copies.slice(0, -BACKUPS_KEPT)) unlinkSync(resolve(dir, old))
    backedUp = true
  }

  function flush() {
    clearTimeout(timer)
    timer = null
    if (!ink) return
    backupOnce()
    const text = serializeInk(ink)
    markOwnWrite(inkPath, text)
    writeAtomic(inkPath, text)
  }

  // A slide whose `id:` was changed in the editor or by hand, at the same
  // place in a deck with the same number of slides, keeps its ink. Ink of a
  // removed slide stays in the file (mdeck check reports it), so undoing the
  // removal brings it back.
  function deckChanged() {
    let deck
    try { deck = readDeck().deck } catch { return [] }
    const ids = deck.slides.map(slide => slide.id)
    const before = knownIds
    knownIds = ids
    if (!before || before.length !== ids.length) return []
    current(deck)
    const moved = []
    ids.forEach((id, i) => {
      const from = before[i]
      if (from !== id && !ids.includes(from) && !before.includes(id) && ink.slides[from]) {
        ink = applyOp(ink, { type: 'rename', from, to: id })
        moved.push({ from, to: id })
      }
    })
    if (moved.length) flush()
    return moved
  }
  try { knownIds = readDeck().deck.slides.map(slide => slide.id) } catch {}

  return {
    path: inkPath,
    deckChanged,
    read() {
      const { deck, hash } = readDeck()
      return { ink: current(deck), deckHash: hash }
    },
    apply(ops, deckHash) {
      let { source, deck, hash } = readDeck()
      current(deck)
      const renamed = []
      const seen = deckHash
      const alias = new Map(renames.filter(r => r.before === seen).map(r => [r.from, r.to]))
      for (const raw of Array.isArray(ops) ? ops : []) {
        const op = { ...raw, slideId: alias.get(raw?.slideId) ?? raw?.slideId }
        if (op.type === 'add') {
          const index = deck.slides.findIndex(slide => slide.id === op.slideId)
          if (index < 0) return { status: 409, error: `No slide "${op.slideId}" in the deck any more`, deckHash: hash }
          const slide = deck.slides[index]
          if (slide.meta.id == null) {
            // An id by position: only trusted for the deck the device saw.
            if (deckHash !== hash) return { status: 409, error: 'The deck changed; reload', deckHash: hash }
            const id = newSlideId(deck, slide, index)
            renames.push({ from: op.slideId, to: id, before: hash })
            source = setSlideMeta(deck, op.slideId, { id })
            markOwnWrite(abs, source)
            writeAtomic(abs, source)
            deck = parseSlides(source)
            hash = hashSource(source)
            deckHash = hash
            ink = applyOp(ink, { type: 'rename', from: op.slideId, to: id })
            renamed.push({ from: op.slideId, to: id })
            alias.set(op.slideId, id)
            op.slideId = id
          }
        }
        ink = applyOp(ink, op)
      }
      knownIds = deck.slides.map(slide => slide.id)
      clearTimeout(timer)
      timer = setTimeout(flush, debounceMs)
      onChange({ renamed })
      return { status: 200, deckHash: hash, renamed }
    },
    flush,
  }
}

// `authorize(request)` may allow requests beyond this computer (pairing).
export function inkMiddleware(file, { authorize = isAllowedRequest } = {}) {
  return async (request, response, next) => {
    const { pathname } = new URL(request.url, 'http://localhost')
    if (pathname !== '/' && pathname !== '/ops') return next()
    if (!authorize(request)) return send(response, 403, { error: 'Only the presenter can change the ink' })
    try {
      if (pathname === '/' && request.method === 'GET') return send(response, 200, file.read())
      if (pathname === '/ops' && request.method === 'POST') {
        const { deckHash, ops } = await readJson(request)
        const result = file.apply(ops, deckHash)
        return send(response, result.status, result)
      }
      response.setHeader('Allow', pathname === '/' ? 'GET' : 'POST')
      return send(response, 405, { error: 'Method not allowed' })
    } catch (error) {
      return send(response, error.status ?? 500, { error: error.message })
    }
  }
}

export function inkPlugin(slidesPath, { authorize } = {}) {
  return {
    name: 'vite-plugin-mdeck-ink',
    configureServer(server) {
      const file = createInkFile(slidesPath, { onChange: ({ renamed }) => server.ws.send('mdeck:ink', { renamed }) })
      server.middlewares.use('/__mdeck/ink', inkMiddleware(file, { authorize }))
      server.watcher.on('change', changed => {
        if (resolve(changed) !== resolve(slidesPath)) return
        const renamed = file.deckChanged()
        if (renamed.length) server.ws.send('mdeck:ink', { renamed })
      })
      server.httpServer?.once('close', () => file.flush())
    },
  }
}
