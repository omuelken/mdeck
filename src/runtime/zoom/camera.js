// Zoom mode's camera: { x, y, w }, the world point at the centre of the view
// and the width of world the view shows.
//
// Flights follow van Wijk and Nuij's smooth zooming and panning path
// ("Smooth and efficient zooming and panning", 2003; d3's interpolateZoom):
// the camera rises in proportion to the distance, so a far jump shows how far
// it goes and a neighbouring slide is a short pan, at a steady perceived speed.

const RHO = Math.SQRT2
const RHO2 = 2
const RHO4 = 4
const EPSILON = 1e-12

// The camera that shows `rect` whole in a view of the given aspect (width /
// height), with `margin` of the larger side around it.
export function fitRect(rect, aspect, margin = 0) {
  const w = Math.max(rect.w, rect.h * aspect) * (1 + 2 * margin)
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2, w }
}

// The CSS transform (origin 0 0) that puts the camera's view in a viewport.
export function cameraTransform(camera, viewWidth, viewHeight) {
  const k = viewWidth / camera.w
  return { k, tx: viewWidth / 2 - camera.x * k, ty: viewHeight / 2 - camera.y * k }
}

const cosh = x => (Math.exp(x) + Math.exp(-x)) / 2
const sinh = x => (Math.exp(x) - Math.exp(-x)) / 2
const tanh = x => { const e = Math.exp(2 * x); return (e - 1) / (e + 1) }

// `at(t)` for t in [0, 1] gives the camera along the path; `length` is the
// path's length in van Wijk's units (about one per doubling or halving).
export function flight(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y, d2 = dx * dx + dy * dy
  const w0 = from.w, w1 = to.w
  let at, length
  if (d2 < EPSILON * w0 * w0) {
    length = Math.log(w1 / w0) / RHO
    at = t => ({ x: from.x + t * dx, y: from.y + t * dy, w: w0 * Math.exp(RHO * t * length) })
  } else {
    const d1 = Math.sqrt(d2)
    const b0 = (w1 * w1 - w0 * w0 + RHO4 * d2) / (2 * w0 * RHO2 * d1)
    const b1 = (w1 * w1 - w0 * w0 - RHO4 * d2) / (2 * w1 * RHO2 * d1)
    const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0)
    const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1)
    length = (r1 - r0) / RHO
    at = t => {
      const s = t * length
      const u = w0 / (RHO2 * d1) * (cosh(r0) * tanh(RHO * s + r0) - sinh(r0))
      return { x: from.x + u * dx, y: from.y + u * dy, w: w0 * cosh(r0) / cosh(RHO * s + r0) }
    }
  }
  length = Math.abs(length)
  return { length, at: t => (t <= 0 ? { ...from } : t >= 1 ? { ...to } : at(t)) }
}

// A straight slide-over at the same zoom, for the next slide in a chapter:
// no rising and landing for a step to a neighbour. `length` is the distance
// in views, weighted so a neighbour takes about half a second.
export function pan(from, to) {
  const ratio = to.w / from.w
  const distance = Math.hypot(to.x - from.x, to.y - from.y) / Math.max(from.w, to.w)
  const at = t => ({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, w: from.w * Math.pow(ratio, t) })
  return { length: distance * 0.75, at: t => (t <= 0 ? { ...from } : t >= 1 ? { ...to } : at(t)) }
}

export const MIN_MS = 450
export const MAX_MS = 1600
export const QUICK_MS = 200

// Milliseconds for a flight of this length.
export function durationFor(length) {
  return Math.round(Math.min(MAX_MS, Math.max(MIN_MS, length * 650)))
}

// Slow at both ends, so a flight starts and lands gently.
export const ease = t => (1 - Math.cos(Math.PI * t)) / 2
