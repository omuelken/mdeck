// A countdown the room can see, as a deck component: mdeck itself stays as
// it is. Put `<countdown />` on one slide of a deck (any slide: slides stay
// mounted, so it starts with the deck) and list this folder in the deck's
// settings:
//
//   components:
//     - ~/work/gitlab/my_repos/mdeck/contrib/countdown
//
// The tag shows nothing where it stands. It hangs the countdown over the
// whole page instead, in every window of the talk:
// - the presenter view (on the laptop, a paired iPad and the phone clicker)
//   gets a timer button in its bar, beside the pen, with the controls
//   (`PresenterTool` from `mdeck/component`),
// - the audience window and a full deck window show the countdown when the
//   presenter shows it, in a corner or big in the middle; at the end it
//   moves big into the middle and plays the chosen sound.
//
// Sounds: the audio files in ./sounds beside this file, named after the
// file (`Gong.mp3` → Gong).
//
// The windows share the countdown through `mdeck/component` (useShared,
// under the name SHARED): the windows of one browser and a paired iPad.
// They tell each other the time left, not a clock time, so an iPad and a
// laptop whose clocks differ still agree; the window that set it last
// repeats it every few seconds, so the others stay in step.
import { h, render } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { useShared, useView, PresenterTool } from 'mdeck/component'

const SHARED = 'countdown'
// Tells this window's own changes from the others' when they come back.
const WINDOW = Math.random().toString(36).slice(2)
const MINUTE = 60000
const PRESETS = [1, 3, 5, 10, 15, 30]
const POSITIONS = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center']
const PLACES = { 'top-left': 'Top left', 'top-right': 'Top right', 'bottom-left': 'Bottom left', 'bottom-right': 'Bottom right', center: 'Big, in the middle' }
// A window that opens or reloads learns the countdown within this time.
const REPEAT_MS = 3000
// A repetition that differs from what a window shows only by its travel
// time must not move the countdown back a little every few seconds.
const DRIFT_MS = 1500
// One window of a browser plays each sound: the audience window at once,
// the others a moment later and only if no window took it.
const LOCK_HOLD_MS = 2000
const SECOND_WINDOW_MS = 400

const SOUNDS = Object.entries(import.meta.glob('./sounds/*.{mp3,m4a,aac,wav,ogg,oga,opus,flac,MP3,M4A,WAV}', { eager: true, query: '?url', import: 'default' }))
  .map(([path, src]) => ({ name: path.split('/').pop().replace(/\.[^.]+$/, ''), src }))
  .sort((a, b) => a.name.localeCompare(b.name))
const soundSrc = name => SOUNDS.find(sound => sound.name === name)?.src ?? null

// The icons, drawn like mdeck's own (src/core/icons.js): Lucide on the 24px
// grid with the same stroke, so the button sits beside the folded ink toolbar
// as one of its kind and the panel's buttons look like mdeck's. Copied, so
// the folder needs nothing from mdeck's sources.
const ICONS = {
  timer: '<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>', // timer
  play: '<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/>', // play
  pause: '<rect x="14" y="3" width="5" height="18" rx="1"/><rect x="5" y="3" width="5" height="18" rx="1"/>', // pause
  reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>', // rotate-ccw
  'top-left': '<path d="M7 17V7h10"/><path d="M17 17 7 7"/>', // arrow-up-left
  'top-right': '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>', // arrow-up-right
  'bottom-left': '<path d="M17 7 7 17"/><path d="M17 17H7V7"/>', // arrow-down-left
  'bottom-right': '<path d="m7 7 10 10"/><path d="M17 7v10H7"/>', // arrow-down-right
  center: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="1"/>', // circle-dot
}
const Icon = ({ name, size = 18 }) => <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display: block" dangerouslySetInnerHTML={{ __html: ICONS[name] }} />

// --- Which window this is -------------------------------------------------

// The presenter's slide gets the controls, the audience and deck windows show
// the countdown; previews, followers and the reader leave it out.
const ROLES = new Set(['presenter', 'audience', 'deck'])

// An iPad says it is a Mac, but has a touch screen.
const onIpad = () => /iPad/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)

// --- The countdown --------------------------------------------------------
// { running, endsAt, remaining, duration, visible, position, sound, volume,
//   quiet, test }: `endsAt` (this window's clock) only while running,
// `remaining` while not; `sound` is a name of SOUNDS; `quiet` stops the
// sound; a new `test` number plays it once.

const newTimer = () => ({ running: false, endsAt: null, remaining: 5 * MINUTE, duration: 5 * MINUTE, visible: true, position: 'top-right', sound: SOUNDS[0]?.name ?? null, volume: 0.8, quiet: false, test: 0 })
const timeLeft = (timer, now = Date.now()) => !timer ? 0 : Math.max(0, timer.running ? timer.endsAt - now : timer.remaining)

const encode = timer => ({ running: !!timer.running && timeLeft(timer) > 0, remaining: timeLeft(timer), duration: timer.duration, visible: !!timer.visible, position: timer.position, sound: timer.sound ?? null, volume: timer.volume ?? 0.8, quiet: !!timer.quiet, test: timer.test || 0 })

function decode(message, now = Date.now()) {
  if (!message || typeof message !== 'object') return null
  const number = value => Number.isFinite(value) && value >= 0 ? value : 0
  const remaining = number(message.remaining), duration = number(message.duration) || remaining
  const running = !!message.running && remaining > 0
  return {
    running, endsAt: running ? now + remaining : null, remaining, duration,
    visible: !!message.visible,
    position: POSITIONS.includes(message.position) ? message.position : 'top-right',
    sound: typeof message.sound === 'string' && message.sound ? message.sound : null,
    volume: Number.isFinite(message.volume) ? Math.min(1, Math.max(0, message.volume)) : 0.8,
    quiet: !!message.quiet, test: number(message.test),
  }
}

/** What a window shows after a message: `incoming`, unless it only repeats `current`. */
function follow(current, incoming) {
  if (!current || !incoming) return incoming ?? current
  const time = current.running && incoming.running ? Math.abs(current.endsAt - incoming.endsAt) < DRIFT_MS
    : !current.running && !incoming.running && current.remaining === incoming.remaining
  const same = time && current.duration === incoming.duration
    && current.visible === incoming.visible && current.position === incoming.position
    && current.sound === incoming.sound && current.volume === incoming.volume
    && current.quiet === incoming.quiet && current.test === incoming.test
  return same ? current : incoming
}

const start = (timer, now = Date.now()) => { const left = timeLeft(timer, now) || timer.duration; return { ...timer, running: true, endsAt: now + left, remaining: left, quiet: false } }
const pause = (timer, now = Date.now()) => ({ ...timer, running: false, endsAt: null, remaining: timeLeft(timer, now) })
const reset = timer => ({ ...timer, running: false, endsAt: null, remaining: timer.duration, quiet: false })
function setLength(timer, minutes, now = Date.now()) {
  const duration = Math.max(1000, Math.round(minutes * MINUTE))
  return { ...timer, duration, remaining: duration, endsAt: timer.running ? now + duration : null, quiet: false }
}
function addTime(timer, minutes, now = Date.now()) {
  const left = Math.max(0, timeLeft(timer, now) + minutes * MINUTE)
  return timer.running ? { ...timer, endsAt: now + left, remaining: left } : { ...timer, remaining: left }
}

/** 4:05, 12:00 or 1:02:03; seconds round up, so 0:00 shows only at the end. */
function formatTime(ms) {
  const total = Math.ceil(Math.max(0, ms) / 1000)
  const hours = Math.floor(total / 3600), minutes = Math.floor(total / 60) % 60, seconds = total % 60
  const two = n => String(n).padStart(2, '0')
  return hours ? `${hours}:${two(minutes)}:${two(seconds)}` : `${Math.floor(total / 60)}:${two(seconds)}`
}

/** Re-renders when the shown second changes, right at the change. */
function useTick(timer) {
  const [, tick] = useState(0)
  useEffect(() => {
    if (!timer?.running) return
    let id
    const next = () => {
      const left = timeLeft(timer)
      if (left <= 0) { tick(n => n + 1); return }
      id = setTimeout(() => { tick(n => n + 1); next() }, (left % 1000 || 1000) + 5)
    }
    next()
    return () => clearTimeout(id)
  }, [timer])
}

// --- Between windows ------------------------------------------------------

/**
 * The countdown as this window knows it, and `change(fn)` to set it here.
 * The window that set it last repeats it while it runs or shows, and once
 * after any change, so the shared value soon holds the time left and no
 * longer says `fresh`: a window that opens later gets it from the others
 * and does not take an old sound test for a new one.
 */
function useSharedTimer(controls) {
  const [shared, setShared] = useShared(SHARED, null)
  const [timer, setTimer] = useState(() => controls ? newTimer() : null)
  const latest = useRef(timer), owner = useRef(false), unsent = useRef(false)
  const send = (next, fresh) => setShared({ ...encode(next), fresh, by: WINDOW })
  useEffect(() => {
    // This window's own value, back from useShared, is already shown.
    if (!shared || shared.by === WINDOW) return
    const next = decode(shared)
    if (!next) return
    owner.current = false
    setTimer(current => { const shown = follow(current, next); latest.current = shown === current ? current : { ...shown, fresh: !!shared.fresh }; return latest.current })
  }, [shared])
  useEffect(() => {
    const repeat = setInterval(() => {
      const now = latest.current
      if (!owner.current || !now || !(now.running || now.visible || unsent.current)) return
      unsent.current = false
      send(now, false)
    }, REPEAT_MS)
    return () => clearInterval(repeat)
  }, [])
  const change = fn => {
    const next = { ...fn(latest.current ?? newTimer()), fresh: true }
    latest.current = next
    owner.current = true
    unsent.current = true
    setTimer(next)
    send(next, true)
  }
  return [timer, change]
}

// --- The sound ------------------------------------------------------------

// A short silent sound: if it plays without a click, the browser lets this
// page play sound (the site may autoplay), and no click is asked for.
function silentSound() {
  const samples = 800, buffer = new ArrayBuffer(44 + samples * 2), view = new DataView(buffer)
  const text = (at, value) => [...value].forEach((char, i) => view.setUint8(at + i, char.charCodeAt(0)))
  text(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); text(8, 'WAVEfmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, 8000, true); view.setUint32(28, 16000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  text(36, 'data'); view.setUint32(40, samples * 2, true)
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }))
}

/**
 * Plays the sound once when the countdown reaches zero here (not in a window
 * that opened after the end), stops it on `quiet`, a new start or a reset,
 * and plays it once for a new `test`. `blocked`: the browser waits for a
 * click before this window may play sound.
 */
function useEndSound(timer, { plays, first, lock }) {
  const audioRef = useRef(null), rung = useRef(false), sawRunning = useRef(false), lastTest = useRef(null)
  // What plays: the end sound stops when the countdown runs again or is
  // reset; a test plays to its end, unless stopped.
  const ringing = useRef(null)
  const [offer, setOffer] = useState(false)
  const [autoplay, setAutoplay] = useState(false)
  useEffect(() => {
    if (!plays || navigator.userActivation?.hasBeenActive !== false) return
    const probe = new Audio(silentSound())
    probe.play().then(() => setAutoplay(true)).catch(() => {}).finally(() => URL.revokeObjectURL(probe.src))
  }, [])
  const audio = () => {
    const src = soundSrc(timer?.sound)
    if (!src) return null
    let element = audioRef.current
    if (!element || element.dataset.src !== src) {
      element?.pause()
      element = new Audio(src)
      element.dataset.src = src
      element.preload = 'auto'
      audioRef.current = element
    }
    element.volume = timer.volume ?? 0.8
    return element
  }
  // Also a sound that is only about to start.
  const stop = () => { const element = audioRef.current; if (element) { element.pause(); element.currentTime = 0 } }
  const play = kind => {
    if (!plays) return
    ringing.current = kind
    const element = audio()
    if (!element) return
    const go = () => {
      element.currentTime = 0
      return element.play().then(() => { setOffer(false); return true }).catch(error => { if (error?.name === 'NotAllowedError') setOffer(true); return false })
    }
    if (!navigator.locks) { go(); return }
    setTimeout(() => navigator.locks.request(lock, { ifAvailable: true }, async held => {
      // A window the browser blocks gives the sound up at once; one that
      // never starts (a stalled file) after a while.
      if (held && await Promise.race([go(), new Promise(done => setTimeout(done, LOCK_HOLD_MS, true))])) await new Promise(done => setTimeout(done, LOCK_HOLD_MS))
    }), first ? 0 : SECOND_WINDOW_MS)
  }
  useEffect(() => {
    if (!timer) return
    if (!timer.sound || timer.quiet) { stop(); return }
    if (audioRef.current) audioRef.current.volume = timer.volume ?? 0.8
    const left = timeLeft(timer)
    if (left > 0) {
      rung.current = false
      if (ringing.current === 'end') stop()
      if (!timer.running) return
      sawRunning.current = true
      const id = setTimeout(() => { if (!rung.current) { rung.current = true; play('end') } }, left)
      return () => clearTimeout(id)
    }
    if (sawRunning.current && !rung.current) { rung.current = true; play('end') }
  }, [timer])
  useEffect(() => {
    if (!timer) return
    // A window that hears of the countdown with this very try plays it too;
    // one that opens later and learns an old try from a repetition does not.
    if (timer.test !== lastTest.current && (lastTest.current !== null || (timer.fresh && timer.test > 0))) play('test')
    lastTest.current = timer.test
  }, [timer?.test])
  const allow = () => {
    setOffer(false)
    const element = audio()
    if (!element) return
    if (timer && !timer.quiet && timeLeft(timer) === 0 && sawRunning.current) { play('end'); return }
    element.muted = true
    element.play().then(() => { element.pause(); element.currentTime = 0; element.muted = false }).catch(() => { element.muted = false })
  }
  const blocked = plays && !!soundSrc(timer?.sound) && (offer || (navigator.userActivation?.hasBeenActive === false && !autoplay))
  return { blocked, allow }
}

// --- On the screen --------------------------------------------------------

function Panel({ timer, change }) {
  const [custom, setCustom] = useState('')
  const left = timeLeft(timer)
  const useCustom = value => { const minutes = Number(String(value).replace(',', '.')); if (minutes > 0) { change(t => setLength(t, minutes)); setCustom('') } }
  const on = active => active ? ' is-on' : ''
  return <div class="countdown-panel" role="group" aria-label="Countdown">
    <div class="countdown-row">
      <span class="countdown-panel-time" data-ending={left > 0 && left <= MINUTE ? '' : undefined} data-done={left === 0 ? '' : undefined}>{formatTime(left)}</span>
      <span class="countdown-row">
        <button title={timer.running ? 'Pause' : 'Start'} onClick={() => change(t => t.running ? pause(t) : start(t))}><Icon name={timer.running ? 'pause' : 'play'} /></button>
        <button title="One more minute" onClick={() => change(t => addTime(t, 1))}>+1′</button>
        <button title="Back to the full length" onClick={() => change(reset)}><Icon name="reset" /></button>
        <button class={on(timer.visible)} title={timer.visible ? 'Hide from the room' : 'Show to the room'} onClick={() => change(t => ({ ...t, visible: !t.visible }))}>{timer.visible ? 'Hide' : 'Show'}</button>
      </span>
    </div>
    <div class="countdown-row">
      {PRESETS.map(minutes => <button class={on(timer.duration === minutes * MINUTE)} onClick={() => change(t => setLength(t, minutes))}>{minutes}′</button>)}
      <input type="text" inputmode="decimal" placeholder="min" aria-label="Minutes" value={custom}
        onInput={event => setCustom(event.currentTarget.value)}
        onKeyDown={event => { if (event.key === 'Enter') useCustom(event.currentTarget.value) }}
        onBlur={event => useCustom(event.currentTarget.value)} />
    </div>
    <div class="countdown-row" role="group" aria-label="Where the room sees it">
      {['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'].map(place => <button class={on(timer.position === place)} title={PLACES[place]} aria-label={PLACES[place]} aria-pressed={timer.position === place} onClick={() => change(t => ({ ...t, position: place }))}><Icon name={place} /></button>)}
    </div>
    {SOUNDS.length > 0 && <div class="countdown-row" role="group" aria-label="Sound at the end">
      <select aria-label="Sound at the end" value={timer.sound ?? ''} onChange={event => { const sound = event.currentTarget.value || null; change(t => ({ ...t, sound })) }}>
        <option value="">No sound</option>
        {SOUNDS.map(({ name }) => <option value={name}>{name}</option>)}
      </select>
      <input type="range" min="0" max="1" step="0.05" aria-label="Volume" title="Volume" value={timer.volume ?? 0.8} onChange={event => { const volume = Number(event.currentTarget.value); change(t => ({ ...t, volume })) }} />
      <button title="Play the sound once where the room hears it" disabled={!timer.sound} onClick={() => change(t => ({ ...t, test: (t.test || 0) + 1, quiet: false }))}>Try</button>
      {/* At the end, Stop also takes the countdown off the screen. */}
      <button title={left === 0 ? 'Stop the sound and hide the countdown' : 'Stop the sound'} disabled={!timer.sound && left > 0} onClick={() => change(t => ({ ...t, quiet: true, visible: timeLeft(t) === 0 ? false : t.visible }))}>Stop</button>
    </div>}
  </div>
}

function Countdown({ role }) {
  const controls = role === 'presenter'
  const [timer, change] = useSharedTimer(controls)
  useTick(timer)
  // Where the room hears it: the audience window first, a deck window or the
  // laptop's presenter frame if none of its browser plays it. A paired iPad
  // leaves the sound to the laptop.
  const plays = role === 'audience' || role === 'deck' || (role === 'presenter' && !onIpad())
  const sound = useEndSound(timer, { plays, first: role === 'audience', lock: `mdeck-countdown:${location.pathname}` })
  const [, activated] = useState(0)
  useEffect(() => {
    const done = () => activated(n => n + 1)
    window.addEventListener('pointerdown', done, { once: true, capture: true })
    window.addEventListener('keydown', done, { once: true, capture: true })
    return () => { window.removeEventListener('pointerdown', done, true); window.removeEventListener('keydown', done, true) }
  }, [])
  const left = timeLeft(timer)
  // The button shows the time while it counts, and the end until it is stopped.
  const showing = timer && (timer.visible || (timer.running && !timer.quiet))
  return <>
    {timer?.visible && role !== 'presenter' && <div class={`countdown-clock countdown-clock--${left === 0 ? 'center' : timer.position}`} role="timer" aria-live="off"
      data-ending={left > 0 && left <= MINUTE ? '' : undefined} data-done={left === 0 ? '' : undefined}>{formatTime(left)}</div>}
    {sound.blocked && <button type="button" class="countdown-sound" onClick={() => { sound.allow(); activated(n => n + 1) }}>Click for sound</button>}
    {controls && <PresenterTool label="Countdown for the room" css={TOOL_STYLES}
      button={<span class={`countdown-toggle${timer.visible ? ' is-shown' : ''}`} data-ending={showing && left > 0 && left <= MINUTE ? '' : undefined} data-done={showing && left === 0 ? '' : undefined}>
        {showing ? formatTime(left) : <Icon name="timer" />}
      </span>}>
      <Panel timer={timer} change={change} />
    </PresenterTool>}
  </>
}

const STYLES = `
.countdown-clock {
  position: fixed; z-index: 2147481000; pointer-events: none;
  font: 650 clamp(36px, 10vh, 160px)/1 ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  font-variant-numeric: tabular-nums; letter-spacing: 0.02em; direction: ltr;
  color: #fff; background: rgba(0, 0, 0, 0.74); border-radius: 0.22em; padding: 0.12em 0.32em;
  box-shadow: 0 0.06em 0.3em rgba(0, 0, 0, 0.35);
}
.countdown-clock--top-right { top: 2.5vh; right: 2vw; }
.countdown-clock--top-left { top: 2.5vh; left: 2vw; }
.countdown-clock--bottom-right { bottom: 2.5vh; right: 2vw; }
.countdown-clock--bottom-left { bottom: 2.5vh; left: 2vw; }
.countdown-clock--center { top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: clamp(90px, 34vh, 520px); background: rgba(0, 0, 0, 0.8); }
.countdown-clock[data-ending] { color: #f5a524; }
.countdown-clock[data-done] { color: #f28b82; }
.countdown-clock[data-done] { animation: countdown-done 0.9s ease-in-out 4; }
@keyframes countdown-done { 50% { opacity: 0.25; } }
@media (prefers-reduced-motion: reduce) { .countdown-clock[data-done] { animation: none; } }
.countdown-sound {
  position: fixed; z-index: 2147481001; left: 50%; bottom: 2.5vh; transform: translateX(-50%);
  font: 600 15px/1 ui-sans-serif, system-ui, sans-serif; padding: 10px 16px; border-radius: 999px; border: 0;
  color: #fff; background: rgba(0, 0, 0, 0.74); cursor: pointer;
}
@media print { .countdown-host { display: none !important; } }
`

// The button and its panel, in the presenter view's page (PresenterTool):
// the panel's frame and the button's are mdeck's own; inside, the buttons and
// fields as mdeck's (src/runtime/chrome.jsx, S.btn and S.select), a selected
// one as the ink toolbar's.
const TOOL_STYLES = `
.countdown-toggle { position: static; display: inline-flex; align-items: center; font-variant-numeric: tabular-nums; }
.countdown-toggle[data-ending], .countdown-panel-time[data-ending] { color: #f5a524; }
.countdown-toggle[data-done], .countdown-panel-time[data-done] { color: #f28b82; }
/* The room sees the countdown: a yellow dot, where the ink button shows its colour. */
.countdown-toggle.is-shown::after {
  content: ''; position: absolute; right: 4px; bottom: 4px; width: 8px; height: 8px; border-radius: 50%;
  background: #f5a524; box-shadow: 0 0 0 1.5px #222;
}
.countdown-panel {
  display: flex; flex-direction: column; gap: 8px;
  -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
}
.countdown-panel button { touch-action: manipulation; }
.countdown-panel input[type=text] { -webkit-user-select: text; user-select: text; }
.countdown-panel button, .countdown-panel select, .countdown-panel input[type=text] {
  display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  font: inherit; color: #e0e0e0; background: #222; border: 1px solid #3a3a3a; border-radius: 8px;
  padding: 6px 9px; min-width: 36px; min-height: 34px; cursor: pointer; box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}
.countdown-panel button:hover:not(:disabled) { background: #2a2a2a; }
.countdown-panel button:disabled { opacity: 0.4; cursor: default; }
.countdown-panel .is-on, .countdown-panel .is-on:hover:not(:disabled) { background: #27436a; border-color: #3d6094; color: #fff; }
.countdown-panel :is(button, select, input):focus { outline: none; }
.countdown-panel :is(button, select, input):focus-visible { outline: 2px solid #6ea0e8; outline-offset: 1px; }
.countdown-row { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.countdown-panel > .countdown-row:first-child { justify-content: space-between; gap: 10px; }
.countdown-panel-time { font-size: 26px; font-variant-numeric: tabular-nums; color: #f0f0f0; }
.countdown-panel input[type=text] { width: 56px; cursor: text; }
.countdown-panel select { flex: 1; min-width: 0; }
.countdown-panel input[type=range] { width: 80px; accent-color: #6ea0e8; }
`

let mounted = false

/** `<countdown />`: starts the countdown for this window; shows nothing itself. */
export default function CountdownTag() {
  const ref = useRef()
  const role = useView()
  useEffect(() => {
    // Once per window; not in previews, printouts or Read mode.
    if (mounted || !ROLES.has(role) || ref.current?.closest('[data-deck-static]')) return
    mounted = true
    const style = document.createElement('style')
    style.textContent = STYLES
    document.head.appendChild(style)
    const host = document.createElement('div')
    host.className = 'countdown-host export-hidden'
    document.body.appendChild(host)
    render(<Countdown role={role} />, host)
  }, [])
  return <span ref={ref} hidden />
}
