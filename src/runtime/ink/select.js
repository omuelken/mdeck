// Selecting and moving drawn strokes. The select tool's lasso (`inkselect`,
// { phase, slideId, point, points } in design pixels) selects the strokes at
// least half inside it, its tap the topmost stroke under it; a finger's tap
// while drawing (`inktap`) selects the stroke under the finger. A selection
// then takes the pen that lands on it, whatever the tool: inside its box the
// pen moves it, and a straight line (two points) shows handles at its ends
// that the pen moves one at a time. Changes show at once in this window and
// become one change (undo puts the strokes back) when the pen lifts.
import { slideStrokes, changeInk, onInkChange } from './store.js'
import { strokesInLasso, strokesBox, translateStroke, hitTest, snapAngle } from '../../core/ink.js'

const PAD = 14        // design pixels around a selection
const TAP = 10        // a lasso smaller than this is a tap
const HANDLE = 40     // design pixels around an end point that grab it

export function createInkSelection(stage, controller) {
  let slideId = null, ids = new Set(), drag = null
  const listeners = new Set()
  const selected = () => slideStrokes(slideId).filter(stroke => ids.has(stroke.id))
  // The end points of a lone straight line.
  const handles = () => { const strokes = selected(); return strokes.length === 1 && strokes[0].points.length === 2 ? strokes[0].points : [] }

  function show(lasso = null) {
    const strokes = slideId ? selected() : []
    stage.showSelection({ box: strokes.length ? strokesBox(strokes, PAD) : null, lasso, handles: drag?.handle == null ? handles() : [] })
  }
  function select(id, strokes) {
    slideId = id
    ids = new Set(strokes.map(stroke => stroke.id))
    for (const listener of listeners) listener(ids.size)
    show()
  }
  const handleAt = point => handles().findIndex(([x, y]) => Math.hypot(point[0] - x, point[1] - y) <= HANDLE)
  const insideBox = point => {
    const box = ids.size ? strokesBox(selected(), PAD) : null
    return !!box && point[0] >= box[0] && point[0] <= box[2] && point[1] >= box[1] && point[1] <= box[3]
  }

  // The stage asks before it lets the pen draw.
  stage.inkSelectionHit = point => !!ids.size && stage._inkSlideId?.() === slideId && (handleAt(point) >= 0 || insideBox(point))
  stage.inkSelectionClear = () => clear()

  stage.addEventListener('inktap', ({ detail }) => {
    const hit = [...slideStrokes(detail.slideId)].reverse().find(stroke => hitTest(stroke, detail.point, detail.radius ?? 22))
    select(detail.slideId, hit ? [hit] : [])
  })

  stage.addEventListener('inkselect', ({ detail }) => {
    const { phase, point, points } = detail
    if (phase === 'down') {
      const handle = detail.slideId === slideId ? handleAt(point) : -1
      if (handle >= 0) {
        drag = { handle, original: selected()[0] }
      } else if (detail.slideId === slideId && insideBox(point)) {
        drag = { from: point, originals: selected() }
      } else {
        drag = null
        select(detail.slideId, [])
      }
      show()
    } else if (phase === 'move') {
      if (drag?.handle != null) {
        changeInk({ type: 'add', slideId, stroke: moveEnd(drag.original, drag.handle, point) })
        show()
      } else if (drag) {
        const dx = point[0] - drag.from[0], dy = point[1] - drag.from[1]
        for (const stroke of drag.originals) changeInk({ type: 'add', slideId, stroke: translateStroke(stroke, dx, dy) })
        show()
      } else show(points)
    } else if (phase === 'up') {
      if (drag?.handle != null) {
        const { original, handle } = drag
        drag = null
        const moved = moveEnd(original, handle, point)
        if (moved.points[handle][0] !== original.points[handle][0] || moved.points[handle][1] !== original.points[handle][1]) {
          controller.replaceStrokes({ slideId, before: [original], after: [moved] })
        }
        show()
        return
      }
      if (drag) {
        const dx = point[0] - drag.from[0], dy = point[1] - drag.from[1]
        const { originals } = drag
        drag = null
        if (dx || dy) controller.replaceStrokes({ slideId, before: originals, after: originals.map(stroke => translateStroke(stroke, dx, dy)) })
        show()
        return
      }
      const strokes = slideStrokes(detail.slideId)
      const span = strokesBox([{ points, size: 0 }])
      const tap = span[2] - span[0] < TAP && span[3] - span[1] < TAP
      select(detail.slideId, tap ? [...strokes].reverse().filter(stroke => hitTest(stroke, point, 12)).slice(0, 1) : strokesInLasso(strokes, points))
    }
  })

  // Strokes that went away (eraser, undo, another window) leave the selection.
  onInkChange(() => {
    if (!ids.size || drag) return
    const present = new Set(selected().map(stroke => stroke.id))
    if (present.size !== ids.size) select(slideId, selected())
    else show()
  })
  function clear() { drag = null; if (ids.size || slideId) select(null, []) }
  stage.addEventListener('slidechange', clear)
  stage.addEventListener('inkmode', event => { if (!event.detail.inking) clear() })

  return {
    /** Calls `listener(count)` whenever the selection changes. */
    subscribe(listener) { listeners.add(listener); listener(ids.size); return () => listeners.delete(listener) },
    clear,
    count: () => ids.size,
    remove() {
      const strokes = selected()
      if (!strokes.length) return
      controller.removeStrokes({ slideId, strokes })
      select(slideId, [])
    },
  }
}

// The stroke with one end point moved to `point` (its pressure kept).
// The other end stays put, and the moved one snaps to steps of 15° around it.
function moveEnd(stroke, index, point) {
  const [x, y] = snapAngle(stroke.points[1 - index], point)
  return { ...stroke, points: stroke.points.map((p, i) => i === index ? [x, y, p[2]] : p) }
}
