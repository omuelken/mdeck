// The deck's ink in the browser: what the ink file held when the page was
// built, plus changes made since. Components subscribe to one slide.
import { useEffect, useState } from 'preact/hooks'
import bundled from 'virtual:deck-ink'
import { applyOp } from '../../core/ink.js'

let ink = bundled
const listeners = new Set()

export const currentInk = () => ink
export const slideStrokes = slideId => ink.slides[slideId] ?? []

/** Replaces all ink, for example after the server sent the saved file. */
export function replaceInk(next) {
  ink = next
  for (const listener of listeners) listener(ink)
}

/** Applies one change (see applyOp in core/ink.js) and tells subscribers. */
export function changeInk(op) {
  const next = applyOp(ink, op)
  if (next !== ink) replaceInk(next)
  return next
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
