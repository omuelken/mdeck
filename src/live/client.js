// Audience interaction for slide components: `import { useRoom } from 'mdeck/live'`.
//
// A component is written once and shown twice. On the slide it shows results
// and a QR code; phones that scan the code open the same deck with
// `?view=respond&room=<name>`, where mdeck renders only that component and
// `responding(room)` is true, so it can show the answer form instead.
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
}

let answerTitle = ''
// The answer page names the slide the question came from, for components
// whose question is the slide's heading.
export function setRespondingSlideTitle(title) { answerTitle = title ?? '' }
export function respondingSlideTitle() { return answerTitle }

const page = () => new URL(window.location.href)
const serverBase = () => (settings.server ?? new URL('/__mdeck/live', window.location.origin).href).replace(/\/+$/, '')
const roomPath = room => `${serverBase()}/rooms/${encodeURIComponent(`${settings.deck}.${room}`)}`

/** True on a phone that opened this room's answer page. */
export function responding(room) {
  const url = page()
  return (url.searchParams.get('view') ?? url.searchParams.get('v')) === 'respond' && url.searchParams.get('room') === String(room)
}

function clientId() {
  try {
    let id = localStorage.getItem('mdeck-live-client')
    if (!id) localStorage.setItem('mdeck-live-client', id = crypto.randomUUID())
    return id
  } catch { return (clientId.fallback ??= crypto.randomUUID()) }
}

// The presenter unlocks resetting on a standalone server once with
// ?livekey=… in the address; the key stays in this browser only.
function presenterKey() {
  const storageKey = `mdeck-live-key:${serverBase()}`
  const given = page().searchParams.get('livekey')
  try {
    if (given) localStorage.setItem(storageKey, given)
    return given ?? localStorage.getItem(storageKey)
  } catch { return given }
}

let infoRequest = null
function serverInfo() {
  const key = presenterKey()
  infoRequest ??= fetch(`${serverBase()}/info`, { headers: key ? { Authorization: `Bearer ${key}` } : {} })
    .then(response => response.ok ? response.json() : {}).catch(() => ({}))
  return infoRequest
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

// Phones open the deck where it is reachable: the `live.audience` setting,
// the network address of `mdeck dev --host`, or this page's own address.
// An address only this computer can open is no use to a phone: null.
function joinUrl(room, info) {
  const here = page()
  const base = settings.audience ? new URL(settings.audience, here)
    : info.network ? new URL(here.pathname, info.network)
    : new URL(here.pathname, here.origin)
  base.search = ''
  base.hash = ''
  base.searchParams.set('view', 'respond')
  base.searchParams.set('room', room)
  return LOCAL_HOSTS.has(base.hostname) ? null : base.href
}

/**
 * Follow and post to a room.
 *   messages  every message so far: { n, at, from, data }
 *   send(data)  post one; resolves when the server has it
 *   me        this device's id (the `from` of its own messages)
 *   joinUrl   address for the QR code, or null if phones cannot reach this deck
 *   canReset / reset()  presenter only
 *   connected false until the live stream is open
 * Pass { listen: false } on the answer form when it does not need results.
 */
export function useRoom(room, { listen = true } = {}) {
  const [messages, setMessages] = useState([])
  const [connected, setConnected] = useState(false)
  const [info, setInfo] = useState({})

  useEffect(() => { serverInfo().then(setInfo) }, [])

  useEffect(() => {
    if (!listen || !room || typeof EventSource === 'undefined') return
    const source = new EventSource(`${roomPath(room)}/events`)
    source.addEventListener('open', () => setConnected(true))
    source.addEventListener('error', () => setConnected(false))
    source.addEventListener('snapshot', event => setMessages(JSON.parse(event.data).messages))
    source.addEventListener('message', event => { const message = JSON.parse(event.data); setMessages(list => list.some(m => m.n === message.n) ? list : [...list, message]) })
    source.addEventListener('reset', () => setMessages([]))
    return () => source.close()
  }, [room, listen])

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

  return { messages, send, reset, connected, canReset: !!info.canReset, joinUrl: joinUrl(room, info), me: clientId(), respond: responding(room) }
}

/** The latest message of each device, e.g. to count votes that can be changed. */
export function latestByDevice(messages) {
  const latest = new Map()
  for (const message of messages) latest.set(message.from ?? `#${message.n}`, message)
  return [...latest.values()]
}
