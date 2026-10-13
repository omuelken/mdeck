// The slide the talk was on, kept in <deck>.position.json beside the deck
// while `mdeck run` runs, so that after a restart the presenter's screens
// open on it again, at its start, instead of on the first slide. The stage
// room (src/live/server.js) saves every slide change and starts with the
// slide kept; the slide is found again by its id, so slides added before it
// do not matter, and a slide the deck no longer has opens the first one.
//
//   { "slide": "<slide id>" }
//
// The launch page drops it, to start again from the first slide.
import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import { markOwnWrite } from './ownWrites.js'

export const positionFileFor = deckPath => String(deckPath).replace(/\.md$/i, '') + '.position.json'

/** `slides()` gives the ids of the deck's slides as shown, in order. */
export function createPositionFile(deckPath, { slides = () => [], debounceMs = 500 } = {}) {
  const path = positionFileFor(resolve(deckPath))
  const listeners = new Set()
  let kept, timer = null

  const read = () => {
    if (kept !== undefined) return kept
    try { kept = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8'))?.slide ?? null : null } catch { kept = null }
    if (typeof kept !== 'string') kept = null
    return kept
  }

  function flush() {
    clearTimeout(timer)
    timer = null
    if (kept == null) return
    const text = JSON.stringify({ slide: kept }) + '\n'
    try { if (existsSync(path) && readFileSync(path, 'utf8') === text) return } catch {}
    markOwnWrite(path, text)
    const temp = `${path}.${process.pid}.tmp`
    writeFileSync(temp, text, 'utf8')
    renameSync(temp, path)
  }

  return {
    path,
    /** The slide kept, as { slideId, index } in the deck as shown, or null. */
    resume() {
      const slideId = read()
      if (!slideId) return null
      let ids
      try { ids = slides() } catch { return null }
      const index = ids.indexOf(slideId)
      return index > 0 ? { slideId, index } : null
    },
    save(slideId) {
      if (typeof slideId !== 'string' || !slideId || slideId === read()) return
      kept = slideId
      clearTimeout(timer)
      timer = setTimeout(flush, debounceMs)
    },
    // From the launch page: the next start opens the first slide.
    drop() {
      clearTimeout(timer)
      timer = null
      kept = null
      if (existsSync(path)) unlinkSync(path)
      for (const listener of listeners) listener()
    },
    onDrop(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    flush,
  }
}
