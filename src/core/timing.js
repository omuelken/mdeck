// Timing a talk: how long each slide may take (`time: 2m` in its settings,
// `time: 45m` for the whole deck), and where the talk stands against that
// plan while it is given. A rehearsal (runtime/presenter/RehearsalSummary.jsx) writes
// the times it measured back with formatTime.
//
// Times are written 90s, 2m, 1m30s or 1.5m; a bare number is minutes.

export const TIME_STEP = 15

const TIME_RE = /^(?:(\d+(?:\.\d+)?)\s*m(?:in)?)?\s*(?:(\d+(?:\.\d+)?)\s*s(?:ec)?)?$/i

// Seconds, or null for something that is not a time.
export function parseTime(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? Math.round(value * 60) : null
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (/^\d+(\.\d+)?$/.test(text)) return parseTime(Number(text))
  const match = text.match(TIME_RE)
  if (!text || !match || (match[1] == null && match[2] == null)) return null
  const seconds = Math.round(Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0))
  return seconds > 0 ? seconds : null
}

// The way mdeck writes a time: 45s, 2m, 1m30s.
export function formatTime(seconds) {
  const s = Math.max(0, Math.round(seconds))
  const m = Math.floor(s / 60), rest = s % 60
  if (!m) return `${rest}s`
  return rest ? `${m}m${rest}s` : `${m}m`
}

// A clock reading: 4:05, or 1:02:03 past an hour; negative values get a minus.
export function formatClock(seconds) {
  const sign = seconds < 0 ? '-' : ''
  const s = Math.abs(Math.round(seconds))
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, rest = s % 60
  const pad = n => String(n).padStart(2, '0')
  return h ? `${sign}${h}:${pad(m)}:${pad(rest)}` : `${sign}${m}:${pad(rest)}`
}

// A measured time to the nearest step, never less than one step.
export function roundTime(seconds, step = TIME_STEP) {
  return Math.max(step, Math.round(seconds / step) * step)
}

// Each slide's share of the talk. Slides without a time share what the
// deck's `time` leaves; without one they count as nothing. `times` replaces
// slides' own times by id (what a rehearsal just saved).
export function planFor(slides, deckConfig = {}, times = {}) {
  const own = slides.map(slide => parseTime(Object.hasOwn(times, slide.id) ? times[slide.id] : slide.meta?.time))
  const budget = parseTime(deckConfig?.time)
  const set = own.reduce((sum, t) => sum + (t ?? 0), 0)
  const untimed = own.filter(t => t == null).length
  const share = budget && untimed ? Math.max(0, budget - set) / untimed : 0
  const perSlide = own.map(t => t ?? share)
  const start = []
  let total = 0
  for (const t of perSlide) { start.push(total); total += t }
  return { perSlide, start, total, own, budget }
}

// Where the talk stands on slide `index`: the time left on it (negative when
// over), and how far behind the plan the talk is (negative: ahead), in whole
// seconds. The elapsed times may be exact; they are rounded only at the end,
// so the two readings tick steadily.
export function scheduleAt(plan, index, { totalElapsed, slideElapsed }) {
  const planned = plan.perSlide[index] ?? 0
  const slideLeft = Math.ceil(planned - slideElapsed)
  const due = (plan.start[index] ?? plan.total) + Math.min(slideElapsed, planned)
  return { planned, slideLeft, delta: Math.floor(totalElapsed - due) }
}

// A rehearsal's new time for each slide, in seconds or null for none: the
// time it got, rounded, or for a slide it did not reach, the one it has.
export function initialTimes(slides, spent, own = slides.map(slide => parseTime(slide.meta?.time))) {
  return slides.map((slide, i) => spent[slide.id] >= 1 ? roundTime(spent[slide.id]) : own[i])
}

// What saving a rehearsal changes: { slideId: '1m30s' | null } for the slides
// whose new time is not the one they have.
export function changedTimes(slides, own, next) {
  const times = {}
  slides.forEach((slide, i) => { if (next[i] !== own[i]) times[slide.id] = next[i] == null ? null : formatTime(next[i]) })
  return times
}
