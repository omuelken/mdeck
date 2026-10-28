// What <pinpoint> needs on the slide, on the phones (src/live/answer/answer.js
// repeats isInside) and in the results (src/core/resultsReport.js): where a
// tap landed, and whether it is inside the shapes `answer` names.
//
// A tap is { x, y }, each from 0 to 1 across the picture's width and height.

const round = value => Math.round(value * 10000) / 10000

/** A tap as sent, or null: two numbers from 0 to 1. */
export function tapOf(value) {
  const x = Number(value?.x), y = Number(value?.y)
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) return null
  return { x: round(x), y: round(y) }
}

// `answer` names the right spots: shapes separated by `|`, a tap in any of
// them counts. Each shape is a keyword and numbers, all in pixels of the
// picture as stored or all in percent (`62%`):
//   circle x y r          the middle and the radius (`circle` may be left out)
//   rect x y w h          the top left corner, the width and the height
//   poly x y x y x y …    three or more corners
const SHAPES = { circle: n => n === 3, rect: n => n === 4, poly: n => n >= 6 && n % 2 === 0 }

function parseShape(text) {
  const parts = text.trim().split(/[\s,;]+/).filter(Boolean)
  const type = /^[a-z]+$/i.test(parts[0] ?? '') ? parts.shift().toLowerCase() : 'circle'
  if (!SHAPES[type]?.(parts.length)) return null
  const percent = parts.every(part => part.endsWith('%'))
  if (!percent && parts.some(part => part.endsWith('%'))) return null
  const numbers = parts.map(part => Number(part.replace(/%$/, '')))
  if (!numbers.every(Number.isFinite) || numbers.some(number => number < 0)) return null
  const unit = percent ? '%' : 'px'
  if (type === 'circle') return numbers[2] > 0 ? { type, x: numbers[0], y: numbers[1], r: numbers[2], unit } : null
  if (type === 'rect') return numbers[2] > 0 && numbers[3] > 0 ? { type, x: numbers[0], y: numbers[1], w: numbers[2], h: numbers[3], unit } : null
  return { type, points: Array.from({ length: numbers.length / 2 }, (_, i) => [numbers[2 * i], numbers[2 * i + 1]]), unit }
}

/** `answer` as written: [{ type, …, unit: '%' | 'px' }], or null. */
export function parseTarget(text) {
  const parsed = String(text ?? '').split('|').map(parseShape)
  return parsed.length && parsed.every(Boolean) ? parsed : null
}

/**
 * The shapes as taps are measured, each from 0 to 1 across the picture:
 * circles { type, x, y, r, ratio } with `r` across the width and `ratio` the
 * picture's height over its width; rects { type, x, y, w, h }; polygons
 * { type, points: [{ x, y }] }. Without the picture's own size (not loaded
 * yet) there is nothing to measure against.
 */
export function targetOn(target, size) {
  const { width, height } = size ?? {}
  if (!target?.length || !(width > 0) || !(height > 0)) return null
  const ratio = height / width
  return target.map(shape => {
    const [ax, ay] = shape.unit === '%' ? [100, 100] : [width, height]
    if (shape.type === 'circle') return { type: 'circle', x: shape.x / ax, y: shape.y / ay, r: shape.r / (shape.unit === '%' ? 100 : width), ratio }
    if (shape.type === 'rect') return { type: 'rect', x: shape.x / ax, y: shape.y / ay, w: shape.w / ax, h: shape.h / ay }
    return { type: 'poly', points: shape.points.map(([x, y]) => ({ x: x / ax, y: y / ay })) }
  })
}

const finite = (...values) => values.every(Number.isFinite)
function shapeOf(shape) {
  if (shape?.type === 'rect') return finite(shape.x, shape.y, shape.w, shape.h) && shape.w > 0 && shape.h > 0 ? shape : null
  if (shape?.type === 'poly') return Array.isArray(shape.points) && shape.points.length >= 3 && shape.points.every(point => finite(point?.x, point?.y)) ? shape : null
  return finite(shape?.x, shape?.y, shape?.r, shape?.ratio) && shape.r > 0 && shape.ratio > 0 ? { ...shape, type: 'circle' } : null
}

/**
 * The shapes as kept or sent, or null: `{ shapes: [...] }`, or one circle
 * { x, y, r, ratio } on its own, as it was kept before there were other shapes.
 */
export function shapesOf(value) {
  const shapes = Array.isArray(value?.shapes) ? value.shapes.map(shapeOf) : [shapeOf(value)]
  return shapes.length && shapes.every(Boolean) ? shapes : null
}

/** The shapes as kept and sent: a lone circle stays as it was, for older phones and servers. */
export const solutionOf = shapes => shapes?.length === 1 && shapes[0].type === 'circle' ? shapes[0] : shapes?.length ? { shapes } : null

/** Whether a tap is in one of the shapes; a circle is measured in widths so it stays round. */
export function isInside(tap, shapes) {
  if (!tap || !shapes) return false
  return shapes.some(shape => {
    if (shape.type === 'rect') return tap.x >= shape.x && tap.x <= shape.x + shape.w && tap.y >= shape.y && tap.y <= shape.y + shape.h
    if (shape.type === 'poly') {
      let inside = false
      for (let i = 0, j = shape.points.length - 1; i < shape.points.length; j = i++) {
        const a = shape.points[i], b = shape.points[j]
        if ((a.y > tap.y) !== (b.y > tap.y) && tap.x < (b.x - a.x) * (tap.y - a.y) / (b.y - a.y) + a.x) inside = !inside
      }
      return inside
    }
    return Math.hypot(tap.x - shape.x, (tap.y - shape.y) * shape.ratio) <= shape.r
  })
}

/** A tap as people read it: "62.1% 31.4%". */
export const tapText = tap => `${Math.round(tap.x * 1000) / 10}% ${Math.round(tap.y * 1000) / 10}%`
