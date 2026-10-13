// The presenter view's clock: the time of the whole talk and of each slide.
// It reads the wall clock rather than counting ticks, so it does not drift,
// and keeps its state in sessionStorage, so a reload carries on where it was.
// Time counts only while the clock runs; it goes to the slide shown.
//
// A rehearsal is the same clock, started from nothing: the time each slide
// got is what the rehearsal summary offers to save (core/timing.js).
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'

const fresh = () => ({ running: false, rehearsing: false, mark: 0, total: 0, spent: {}, slide: null })

function load(key) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key))
    if (saved && typeof saved.total === 'number' && saved.spent && typeof saved.spent === 'object') return { ...fresh(), ...saved }
  } catch {}
  return fresh()
}

// The time since the last mark goes to the whole talk and the slide shown.
function settle(state, now) {
  if (!state.running || state.slide == null) return { ...state, mark: now }
  const gone = Math.max(0, now - state.mark)
  return { ...state, mark: now, total: state.total + gone, spent: { ...state.spent, [state.slide]: (state.spent[state.slide] ?? 0) + gone } }
}

export function useTalkTimer(key, slideId, { rehearse = false } = {}) {
  const [state, setState] = useState(() => {
    const saved = load(key)
    // ?rehearse=1 starts a rehearsal, unless this page is in one already.
    if (rehearse && !saved.rehearsing) return { ...fresh(), rehearsing: true, running: true, mark: Date.now(), slide: slideId }
    return saved
  })
  const [, setTick] = useState(0)
  const stateRef = useRef(state)
  stateRef.current = state
  const update = change => setState(current => change(settle(current, Date.now())))

  useEffect(() => { try { sessionStorage.setItem(key, JSON.stringify(state)) } catch {} }, [state])
  // At once, not after the next paint: in a background tab that comes late,
  // and the time in between went to the slide before.
  useLayoutEffect(() => { if (slideId != null && slideId !== state.slide) update(s => ({ ...s, slide: slideId })) }, [slideId])
  useEffect(() => {
    if (!state.running) return
    const timer = setInterval(() => setTick(n => n + 1), 500)
    return () => clearInterval(timer)
  }, [state.running])

  const live = state.running ? Math.max(0, Date.now() - state.mark) : 0
  // Exact, not whole seconds: the talk's and the slide's time have different
  // fractions, and rounding each on its own made what lies between them
  // (how far behind the plan) flicker by a second.
  const seconds = ms => ms / 1000
  return {
    running: state.running,
    rehearsing: state.rehearsing,
    totalElapsed: seconds(state.total + live),
    slideElapsed: seconds((state.spent[state.slide] ?? 0) + live),
    // Each slide's time so far, in seconds.
    spent: () => {
      const now = settle(stateRef.current, Date.now())
      return Object.fromEntries(Object.entries(now.spent).map(([id, ms]) => [id, ms / 1000]))
    },
    toggle: () => update(s => ({ ...s, running: !s.running })),
    pause: () => update(s => ({ ...s, running: false })),
    reset: () => setState(s => ({ ...fresh(), slide: s.slide })),
    startRehearsal: () => setState(s => ({ ...fresh(), rehearsing: true, running: true, mark: Date.now(), slide: s.slide })),
    endRehearsal: () => setState(s => ({ ...fresh(), slide: s.slide })),
  }
}
