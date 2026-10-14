// What the presenter can do on the slide shown, for the phone clicker
// (presenter/PresenterView.jsx): the buttons components mark with `data-presenter-control` (a
// poll's lock, eye, tick and Reset), the slide's videos (play or pause), and
// its hotspots (zoom to a part, back to the whole slide). The clicker's slide
// frame reports them; a tap on the clicker presses the original here, so the
// change reaches the other screens the way a click on the slide does.

const activeSlide = stage => stage.querySelector(':scope > [data-deck-active]')

function controlElements(stage) {
  const slide = activeSlide(stage)
  if (!slide) return []
  return [...slide.querySelectorAll('[data-presenter-control], video')].filter(element => !element.closest('[data-deck-static]'))
}

const labelOf = element => element.getAttribute('data-presenter-control') || element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent.trim()

/** { items: [{ label, icon, pressed, disabled }], hotspots: n, hotspot } for the slide shown. `icon` names one of mdeck's icons (`data-presenter-icon`). */
export function slideControls(stage) {
  const items = controlElements(stage).map(element => element.localName === 'video'
    ? { label: element.paused ? 'Play the video' : 'Pause the video', icon: element.paused ? 'play' : 'pause', pressed: !element.paused, disabled: false }
    : { label: labelOf(element), icon: element.getAttribute('data-presenter-icon') || null, pressed: element.getAttribute('aria-pressed') === 'true', disabled: !!element.disabled })
  const hotspots = stage.hotspotMode === 'off' ? 0 : Math.min(9, stage.hotspots.length)
  return { items, hotspots, hotspot: hotspots ? stage.hotspot ?? null : null }
}

/** Presses control `index` of slideControls(stage). */
export function pressSlideControl(stage, index) {
  const element = controlElements(stage)[index]
  if (!element || element.disabled) return false
  if (element.localName === 'video') {
    // Pressed from the toolbar or a phone, not in this frame: the browser may
    // refuse sound here. The audience window plays it; this copy goes silent.
    if (element.paused) element.play().catch(error => {
      if (error?.name !== 'NotAllowedError') return
      element.muted = true
      return element.play()
    }).catch(() => {})
    else element.pause()
  } else element.click()
  return true
}

/** Calls `report(slideControls(stage))` whenever they may have changed, a few times a second at most. */
export function watchSlideControls(stage, report) {
  // A timer, not an animation frame: a presenter view in a background tab
  // gets no frames, but its clicker still wants to know.
  let timer = 0
  const send = () => {
    if (timer) return
    timer = setTimeout(() => { timer = 0; report(slideControls(stage)) }, 60)
  }
  for (const type of ['slidechange', 'statechange', 'zoomchange', 'hotspotschange']) stage.addEventListener(type, send)
  // Videos say when they play or pause; their events do not bubble.
  for (const type of ['play', 'pause']) stage.addEventListener(type, send, true)
  const observer = new MutationObserver(send)
  observer.observe(stage, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-pressed', 'disabled', 'data-deck-active', 'data-presenter-control', 'data-presenter-icon'] })
  send()
  return () => observer.disconnect()
}
