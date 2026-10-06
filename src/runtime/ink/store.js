// The deck's ink in the browser: what the ink file held when the page was
// built, plus changes made since. Components subscribe to one slide.
import { useEffect, useState } from 'preact/hooks'
import bundled from 'virtual:deck-ink'
import { applyOp } from '../../core/ink.js'

let ink = bundled
const listeners = new Set()
// Slides that got an id while the page was open: the rendered slides still
// know their old id (slide-3), the ink uses the new one.
const aliases = new Map()
export const resolveSlideId = slideId => aliases.get(slideId) ?? slideId

export const currentInk = () => ink
export const slideStrokes = slideId => ink.slides[resolveSlideId(slideId)] ?? []

/** Replaces all ink, for example after the server sent the saved file. */
export function replaceInk(next) {
  ink = next
  for (const listener of listeners) listener(ink)
}

/** Applies one change (see applyOp in core/ink.js) and tells subscribers. */
export function changeInk(op) {
  const next = applyOp(ink, op.slideId ? { ...op, slideId: resolveSlideId(op.slideId) } : op)
  if (next !== ink) replaceInk(next)
  return next
}

/** A slide got a new id: its ink and the rendered slide follow. */
export function renameSlide(from, to) {
  if (!from || !to || from === to) return
  aliases.set(from, to)
  for (const [old, current] of aliases) if (current === from) aliases.set(old, to)
  for (const section of document.querySelectorAll(`[data-slide-id="${CSS.escape(from)}"]`)) section.dataset.slideId = to
  changeInk({ type: 'rename', from, to })
  replaceInk(ink)
}

/** Calls `listener(ink)` after every change; returns the way to stop. */
export function onInkChange(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSlideInk(slideId) {
  const [strokes, setStrokes] = useState(() => slideStrokes(slideId))
  useEffect(() => {
    const listener = () => setStrokes(slideStrokes(slideId))
    listeners.add(listener)
    listener()
    return () => listeners.delete(listener)
  }, [slideId])
  return strokes
}
