// Audience interaction for slide components: `import { useRoom } from 'mdeck/live'`.
//
// A component is written once and shown twice. On the slide it shows results
// and a QR code. Every activity in a deck shares one link, `?view=respond`:
// phones that open it follow the presentation and show the activity that is
// on screen, with `responding(room)` true so it can show the answer form.
// `?view=respond&room=<name>` opens one activity directly.
import { useCallback, useEffect, useState } from 'preact/hooks'

// The QR code component the built-in poll uses, for your own activities.
export { default as QrCode } from '../components/QrCode.jsx'

let settings = { server: null, audience: null, deck: 'deck' }

const slug = text => String(text ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)

// Called by the runtime with the deck settings; `live.id` or the title keeps
// rooms of different decks apart on a shared server.
export function configureLive(deckConfig = {}) {
  const live = deckConfig.live ?? {}
  settings = { server: live.server ?? null, audience: live.audience ?? null, deck: slug(live.id ?? deckConfig.meta?.title) || 'deck' }
  takeKeyFromAddress()
}

let answerTitle = ''
// The answer page names the slide the question came from, for components
// whose question is the slide's heading.
export function setRespondingSlideTitle(title) { answerTitle = title ?? '' }
export function respondingSlideTitle() { return answerTitle }

const page = () => new URL(window.location.href)
const serverBase = () => (settings.server ?? new URL('/__mdeck/live', window.location.origin).href).replace(/\/+$/, '')
const roomPath = room => `${serverBase()}/rooms/${encodeURIComponent(`${settings.deck}.${room}`)}`
// The deck's own room carries only its state: which activity is on screen.
const stagePath = () => `${serverBase()}/rooms/${encodeURIComponent(settings.deck)}`

// Which rooms keep a live connection: those on the current slide, set by the
// runtime for each deck it shows. Browsers allow only six connections per
// server, shared by all tabs, so a deck must not hold one per activity.
// null means every room is live (Read mode, print, pages without slides).
let activeRooms = null
const activeListeners = new Set()
export function setActiveRooms(rooms) {
  activeRooms = rooms == null ? null : new Set(rooms.map(String))
  for (const listener of activeListeners) listener()
}
function useActive(room) {
  const [, redraw] = useState(0)
  useEffect(() => {
    const listener = () => redraw(n => n + 1)
    activeListeners.add(listener)
    return () => activeListeners.delete(listener)
  }, [])
  return activeRooms == null || activeRooms.has(String(room)) || responding(room)
}

let followed = null
/** The answer page tells the client which activity it is showing. */
export function setFollowedRoom(room) { followed = room ?? null }

const onAnswerPage = () => { const url = page(); return (url.searchParams.get('view') ?? url.searchParams.get('v')) === 'respond' }

/** True on a phone's answer page while it shows this room. */
export function responding(room) {
  if (!onAnswerPage()) return false
  const direct = page().searchParams.get('room')
  return direct != null ? direct === String(room) : followed === String(room)
}

function clientId() {
  try {
    let id = localStorage.getItem('mdeck-live-client')
    if (!id) localStorage.setItem('mdeck-live-client', id = crypto.randomUUID())
    return id
  } catch { return (clientId.fallback ??= crypto.randomUUID()) }
}

// The presenter unlocks a standalone room server once with ?livekey=… in the
// address. The code is kept in this browser, where the presenter view's other
// windows find it, and taken out of the address bar at once, so it never shows
// on a projector.
let givenKey = null
function takeKeyFromAddress() {
  const url = page()
  const given = url.searchParams.get('livekey')
  if (!given) return
  givenKey = given
  try { localStorage.setItem(`mdeck-live-key:${serverBase()}`, given) } catch {}
  url.searchParams.delete('livekey')
  try { history.replaceState(history.state, '', url) } catch {}
}
function presenterKey() {
  try { return localStorage.getItem(`mdeck-live-key:${serverBase()}`) ?? givenKey } catch { return givenKey }
}

// Only an answer is kept; after a failure the next call asks again, so a room
// server that starts later is found. `reachable` is false when it did not answer.
let infoRequest = null
function serverInfo() {
  const key = presenterKey()
  infoRequest ??= fetch(`${serverBase()}/info`, { headers: key ? { Authorization: `Bearer ${key}` } : {} })
    .then(response => { if (!response.ok) throw new Error(String(response.status)); return response.json() })
    .then(info => ({ ...info, reachable: true }))
    .catch(() => { infoRequest = null; return { reachable: false } })
  return infoRequest
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

// Phones open the deck where it is reachable: the `live.audience` setting,
// the network address of `mdeck dev --host`, or this page's own address.
// Without a room it is the deck's one link that follows the presentation.
// An address only this computer can open is no use to a phone: null.
function joinUrl(room, info) {
  const here = page()
  const base = settings.audience ? new URL(settings.audience, here)
    : info.network ? new URL(here.pathname, info.network)
    : new URL(here.pathname, here.origin)
  base.search = ''
  base.hash = ''
  base.searchParams.set('view', 'respond')
  if (room != null) base.searchParams.set('room', room)
  return LOCAL_HOSTS.has(base.hostname) ? null : base.href
}

/**
 * Follow and post to a room.
 *   messages  every message so far: { n, at, from, data }
 *   send(data)  post one; resolves when the server has it
 *   me        this device's id (the `from` of its own messages)
 *   joinUrl   the deck's answer link for the QR code, or null if phones cannot
 *             reach this deck; roomUrl opens this activity directly
 *   canReset / reset()  presenter only
 *   connected false until the live stream is open
 * Pass { listen: false } on the answer form when it does not need results.
 * Off the current slide the room keeps its last messages but disconnects.
 */
export function useRoom(room, { listen = true } = {}) {
  const active = useActive(room)
  const live = listen && active
  const [messages, setMessages] = useState([])
  const [connected, setConnected] = useState(false)
  const [info, setInfo] = useState({})

  useEffect(() => { serverInfo().then(setInfo) }, [])

  useEffect(() => {
    if (!live || !room || typeof EventSource === 'undefined') return
    const source = new EventSource(`${roomPath(room)}/events`)
    source.addEventListener('open', () => setConnected(true))
    source.addEventListener('error', () => setConnected(false))
    source.addEventListener('snapshot', event => setMessages(JSON.parse(event.data).messages))
    source.addEventListener('message', event => { const message = JSON.parse(event.data); setMessages(list => list.some(m => m.n === message.n) ? list : [...list, message]) })
    source.addEventListener('reset', () => setMessages([]))
    return () => { source.close(); setConnected(false) }
  }, [room, live])

  const send = useCallback(async data => {
    const response = await fetch(roomPath(room), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: clientId(), data }) })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.error ?? `Could not send (${response.status})`)
    return body
  }, [room])

  const reset = useCallback(async () => {
    const key = presenterKey()
    const response = await fetch(`${roomPath(room)}/reset`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) }, body: '{}' })
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? 'Could not reset')
  }, [room])

  return { messages, send, reset, connected, canReset: !!info.canReset, joinUrl: joinUrl(null, info), roomUrl: joinUrl(room, info), me: clientId(), respond: responding(room) }
}

// The presenter's screen names the activity on the current slide, or null,
// and the look it shows (theme, palette, accents), so phones follow a theme
// changed in the presenter view. It repeats this every few seconds, so phones that join late and a room
// server that restarted catch up. Only the presenter may: `steering` says
// whether this screen reaches the phones, and if not, why.
const REPEAT_MS = 4000
let current, currentLook = null, repeat = null
let steering = null
const steeringListeners = new Set()
function report(next) {
  if (steering && steering.ok === next.ok && steering.reason === next.reason) return
  steering = next
  for (const listener of steeringListeners) listener(next)
}

// A presenter view outranks other deck windows in the same browser: while it
// runs, they stay quiet, so two screens on different slides or looks do not
// make the phones flip between them.
let role = 'screen'
export function actAsPresenter() { role = 'presenter' }
const presenterMark = () => `mdeck-live-presenter:${settings.deck}`
function outranked() {
  try {
    if (role === 'presenter') { localStorage.setItem(presenterMark(), String(Date.now())); return false }
    return Date.now() - Number(localStorage.getItem(presenterMark()) ?? 0) < REPEAT_MS * 2.5
  } catch { return false }
}

async function sendCurrent() {
  if (outranked()) return
  const info = await serverInfo()
  if (!info.reachable) return report({ ok: false, reason: 'unreachable' })
  if (!info.canReset) return report({ ok: false, reason: presenterKey() ? 'wrong-code' : 'no-code' })
  const key = presenterKey()
  try {
    const response = await fetch(`${stagePath()}/state`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) }, body: JSON.stringify({ state: { room: current, look: currentLook } }) })
    report(response.ok ? { ok: true } : { ok: false, reason: response.status === 403 ? 'wrong-code' : 'unreachable' })
  } catch { report({ ok: false, reason: 'unreachable' }) }
}

export function announce(room) {
  current = room ?? null
  sendCurrent()
  repeat ??= setInterval(sendCurrent, REPEAT_MS)
}

/** The look this screen shows: { design, palette, accent, accent2 }. */
export function announceLook(look) {
  currentLook = look
  if (repeat) sendCurrent()
}

/** For the presenter view: null before the first announcement, else { ok, reason }. */
export function useSteering() {
  const [state, setState] = useState(steering)
  useEffect(() => {
    steeringListeners.add(setState)
    setState(steering)
    return () => steeringListeners.delete(setState)
  }, [])
  return state
}

/**
 * Follow which activity the presenter shows. `room` is its name or null;
 * `look` the presenter's theme, palette and accents, or null;
 * `announced` is false until the presenter has named one at all.
 */
export function useStage() {
  const [stage, setStage] = useState({ room: null, look: null, announced: false, connected: false })
  useEffect(() => {
    if (typeof EventSource === 'undefined') return
    const source = new EventSource(`${stagePath()}/events`)
    const apply = state => setStage({ room: state?.room ?? null, look: state?.look ?? null, announced: state != null, connected: true })
    source.addEventListener('snapshot', event => apply(JSON.parse(event.data).state))
    source.addEventListener('state', event => apply(JSON.parse(event.data).state))
    source.addEventListener('error', () => setStage(current => ({ ...current, connected: false })))
    return () => source.close()
  }, [])
  return stage
}

/** The latest message of each device, e.g. to count votes that can be changed. */
export function latestByDevice(messages) {
  const latest = new Map()
  for (const message of messages) latest.set(message.from ?? `#${message.n}`, message)
  return [...latest.values()]
}
