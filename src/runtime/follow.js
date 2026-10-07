// The follow view (?view=follow): a phone or laptop in the room shows the
// presenter's slide and ink, read from the stage room, and sends nothing.
// A follower may page back on their own and return with "Back to live";
// slides and steps the presenter has not shown yet stay hidden.

/** Where a follower may be: no further than the furthest the presenter has shown. */
export function clampToShown({ index, step }, furthest) {
  if (!furthest) return { index: 0, step: -1 }
  if (index > furthest.index) return { index: furthest.index, step: furthest.step }
  if (index === furthest.index && step > furthest.step) return { index, step: furthest.step }
  return { index, step }
}

// The furthest of two positions, slide first, then step.
const further = (a, b) => !a ? b : (b.index > a.index || (b.index === a.index && b.step > a.step)) ? b : a

/**
 * The follower's state: the presenter's position, the furthest shown, and
 * whether this device is with the presenter (`live`).
 *   presenter(position)  the presenter moved: returns where to go, or null
 *   moved(position)      the follower moved: returns where to go back to if
 *                        they went past what was shown, else null
 *   backToLive()         returns the presenter's position
 */
export function createFollower() {
  const state = { presenter: null, furthest: null, live: true }
  const same = (a, b) => !!a && !!b && a.index === b.index && a.step === b.step
  return {
    state,
    presenter(position) {
      state.presenter = position
      state.furthest = further(state.furthest, position)
      return state.live ? position : null
    },
    moved(position) {
      const allowed = clampToShown(position, state.furthest)
      state.live = state.presenter ? same(allowed, state.presenter) : true
      return same(allowed, position) ? null : allowed
    },
    backToLive() {
      state.live = true
      return state.presenter
    },
  }
}

const BAR_CSS = `
.follow-bar { position: fixed; left: 50%; top: max(14px, env(safe-area-inset-top)); transform: translateX(-50%); z-index: 2147483001;
  display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border: 1px solid #3a3a3a; border-radius: 999px;
  background: rgba(22, 22, 22, 0.92); color: #e6e6e6; font: 14px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif; white-space: nowrap; }
button.follow-bar { cursor: pointer; }
.follow-dot { width: 8px; height: 8px; border-radius: 50%; background: #e11d48; box-shadow: 0 0 0 3px rgba(225, 29, 72, 0.25); }
`

/**
 * Follow the presenter on `stage`. `onStagePosition` hears the positions the
 * stage room carries; it must be called before the room is listened to.
 * `words` are the labels: live, back, waiting.
 */
export function startFollowing(stage, { onStagePosition, words }) {
  const follower = createFollower()
  const style = document.createElement('style')
  style.textContent = BAR_CSS
  document.head.appendChild(style)
  let bar = null

  function update() {
    const { presenter, live } = follower.state
    const next = !presenter ? document.createElement('div') : live ? document.createElement('div') : document.createElement('button')
    next.className = 'follow-bar'
    if (!presenter) next.textContent = words.waiting
    else if (live) { const dot = document.createElement('span'); dot.className = 'follow-dot'; next.append(dot, words.live) }
    else { next.textContent = words.back; next.addEventListener('click', () => { go(follower.backToLive()); update() }) }
    bar ? bar.replaceWith(next) : document.body.appendChild(next)
    bar = next
  }
  // Positions set from here arrive back as 'sync' and are not the follower's own.
  const go = position => { if (position) stage.setState({ index: position.index, step: position.step }) }

  onStagePosition(position => { go(follower.presenter(position)); update() })
  stage.addEventListener('statechange', event => {
    if (['init', 'sync'].includes(event.detail.reason)) return
    go(follower.moved({ index: event.detail.index, step: event.detail.step }))
    update()
  })
  // Until the presenter's position arrives, the title slide.
  go(follower.moved(stage.state))
  update()
}
