// Hotspots: the parts of a slide the presenter can zoom to with 1–9.
//
// A slide's mode is 'off', 'auto' (pictures, code, tables, maths, videos,
// callouts, columns, data and activities, plus anything marked `data-hotspot`) or
// 'marked' (only the marked ones). The zoom that shows a hotspot is worked
// out for the slide's own shape, not the window's, so every screen that
// follows shows the same part; the stage keeps the view on the slide, so a
// hotspot of another shape shows the slide around it.

import { fitRect } from './zoom/camera.js'

export const HOTSPOT_MODES = ['off', 'auto', 'marked']
export const MAX_HOTSPOTS = 9
// Room around a hotspot, as a share of its larger side.
const MARGIN = 0.06
// A zoom closer than this to the whole slide is not worth a key.
const MIN_SCALE = 1.15
// Smaller than this (in design pixels) is an icon or a bullet, not a hotspot.
const MIN_SIDE = 48

const AUTO = [
  '.dataview', 'img', 'svg', '.themed-picture', '.code-block-wrapper', 'pre', 'table', '.katex-display',
  '.video-player-container', 'video', '.callout', '.columns > .column', '.poll',
].join(', ')
// Never a hotspot, nor anything inside it.
const NEVER = '.slide-header, .slide-footer, .slide-footnotes, .slide-citations, button, a, .katex, [data-ink-ui], [data-hotspot="off"]'

// The mode a slide shows: `forced` is the presenter's switch (true, false or
// null for the deck's own setting).
export function hotspotMode({ slide, deck, forced = null }) {
  if (forced === false) return 'off'
  const own = normalMode(slide)
  const decks = normalMode(deck) ?? 'off'
  if (forced === true) return own ?? (decks === 'off' ? 'auto' : decks)
  return own ?? decks
}

// A setting as written (true and false too) or as an attribute.
export function normalMode(value) {
  if (value === true || value === 'true') return 'auto'
  if (value === false || value === 'false') return 'off'
  return HOTSPOT_MODES.includes(value) ? value : null
}

// The stage's zoom ({ scale, x, y }) that shows `rect` ({ x, y, w, h }, design
// pixels) as large as the slide allows, or null when it nearly fills it.
export function hotspotZoom(rect, { width, height }, { margin = MARGIN, max = Infinity } = {}) {
  if (!(rect.w > 0 && rect.h > 0)) return null
  const camera = fitRect(rect, width / height, margin)
  const scale = Math.min(max, width / camera.w)
  if (scale < MIN_SCALE) return null
  return { scale, x: camera.x, y: camera.y }
}

// Between the stage's zoom and the camera of zoom/camera.js ({ x, y, w }:
// the centre and the width of slide the view shows).
export const zoomToCamera = (zoom, { width }) => ({ x: zoom.x, y: zoom.y, w: width / zoom.scale })
export const cameraToZoom = (camera, { width }) => ({ scale: width / camera.w, x: camera.x, y: camera.y })

// Reading order: rows top to bottom (items that overlap vertically share a
// row), each row left to right; right to left on a right-to-left slide.
export function readingOrder(items, { rtl = false } = {}) {
  const sorted = [...items].sort((a, b) => a.rect.y - b.rect.y)
  const rows = []
  for (const item of sorted) {
    const row = rows.at(-1)
    const middle = item.rect.y + item.rect.h / 2
    if (row && middle < row.bottom) { row.items.push(item); row.bottom = Math.max(row.bottom, item.rect.y + item.rect.h) }
    else rows.push({ items: [item], bottom: item.rect.y + item.rect.h })
  }
  return rows.flatMap(row => row.items.sort((a, b) => rtl ? b.rect.x - a.rect.x : a.rect.x - b.rect.x))
}

// The hotspots of a shown slide: [{ element, rect, zoom }], in reading order.
// `rectOf(element)` gives an element's box in design pixels.
export function findHotspots(slide, { mode, rectOf, design, max = Infinity }) {
  if (!slide || mode === 'off' || !HOTSPOT_MODES.includes(mode)) return []
  const selector = mode === 'marked' ? '[data-hotspot]' : `[data-hotspot], ${AUTO}`
  const chosen = []
  for (const element of slide.querySelectorAll(selector)) {
    const marked = element.hasAttribute('data-hotspot') && element.getAttribute('data-hotspot') !== 'off'
    if (!marked && element.closest(NEVER)) continue
    // Inside a part already chosen: that part shows it.
    if (!marked && chosen.some(item => item.element.contains(element))) continue
    // Not revealed yet, or not shown at all.
    const step = element.closest('[data-step]')
    if (step && !step.hasAttribute('data-step-visible')) continue
    const rect = rectOf(element)
    if (!rect || rect.w <= 0 || rect.h <= 0) continue
    if (!marked && (rect.w < MIN_SIDE || rect.h < MIN_SIDE)) continue
    // Nearly the whole slide: no key, but what is inside may have one.
    const zoom = hotspotZoom(rect, design, { max })
    if (!zoom) continue
    chosen.push({ element, rect, zoom })
  }
  const rtl = slide.closest?.('[dir=rtl]') != null
  return readingOrder(chosen, { rtl }).slice(0, MAX_HOTSPOTS)
}
