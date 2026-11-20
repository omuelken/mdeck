// The deck's ink in the browser: what the ink file held when the page was
// built, plus changes made since. Components subscribe to one slide.
import { useEffect, useState } from 'preact/hooks'
import bundled from 'virtual:deck-ink'
import { applyOp, baseSlideId } from '../../core/ink.js'

let ink = bundled
const listeners = new Set()
// Slides that got an id while the page was open: the rendered slides still
// know their old id (slide-3), the ink uses the new one.
const aliases = new Map()
// A notes sheet's id (slide-3#sheet) follows its slide's.
export const resolveSlideId = slideId => {
  const base = baseSlideId(slideId)
  return base === slideId ? aliases.get(slideId) ?? slideId : (aliases.get(base) ?? base) + slideId.slice(base.length)
}

export const currentInk = () => ink
export const slideStrokes = slideId => ink.slides[resolveSlideId(slideId)] ?? []
/** The slide's notes sheet ({ size }), or null. */
export const slideSheet = slideId => ink.sheets?.[resolveSlideId(slideId)] ?? null

// The reader's Drawings switch leaves the notes sheets out too: the slides
// show no sheet, as a step or as a page, while it is off.
let sheetsShown = true
export function showSheets(on) {
  if (sheetsShown === !!on) return
  sheetsShown = !!on
  for (const listener of listeners) listener(ink)
}

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

/** The slide `from` (its id in another language) shows and takes the ink of `to`. */
export function aliasSlide(from, to) {
  if (!from || !to || from === to) return
  aliases.set(from, to)
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

export function useSlideSheet(slideId) {
  const [sheet, setSheet] = useState(() => sheetsShown ? slideSheet(slideId) : null)
  useEffect(() => {
    const listener = () => setSheet(sheetsShown ? slideSheet(slideId) : null)
    listeners.add(listener)
    listener()
    return () => listeners.delete(listener)
  }, [slideId])
  return sheet
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
