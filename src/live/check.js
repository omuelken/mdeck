// `mdeck server --check <address>`: asks a running server, from outside, what
// a deck and `mdeck run --server` need of it, and says what to change when
// the web server in front of it is the cause. Each step answers
// { name, status: 'ok' | 'warn' | 'fail', detail }.
import { randomBytes } from 'node:crypto'
import { WebSocket } from 'ws'
import { VERSION } from './rooms.js'

const fail = (name, detail) => ({ name, status: 'fail', detail })
const warn = (name, detail) => ({ name, status: 'warn', detail })
const ok = (name, detail) => ({ name, status: 'ok', detail })
const why = error => error?.cause?.code ?? error?.cause?.message ?? error?.message ?? String(error)

// Versions compare as numbers, not as text.
const older = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0); return false }

async function reach(origin, timeoutMs) {
  const get = path => fetch(new URL(path, origin), { signal: AbortSignal.timeout(timeoutMs), redirect: 'manual' })
  try {
    // An older server has no /health; /info says it is there as well.
    let response = await get('/health')
    if (response.status === 404) response = await get('/info')
    if (response.status >= 300 && response.status < 400) return { result: fail('Reachable', `${origin} redirects to ${response.headers.get('location') ?? 'another address'}; use that address, with https if it is the one that answers`) }
    return response.ok ? { result: ok('Reachable', `${origin} answers`) } : { result: fail('Reachable', `${origin} answers ${response.status}, which a mdeck server does not`) }
  } catch (error) {
    return { result: fail('Reachable', `${origin} does not answer (${why(error)})`) }
  }
}

async function info(origin, timeoutMs) {
  try {
    const response = await fetch(new URL('/info', origin), { signal: AbortSignal.timeout(timeoutMs) })
    const body = response.ok ? await response.json() : null
    if (!body || typeof body.version !== 'string') return [fail('mdeck server', 'the address answers, but it is not a mdeck server (/info has no version)')]
    const results = [body.version === VERSION ? ok('Version', `${body.version}, the same as this mdeck`)
      : older(body.version, VERSION) ? warn('Version', `the server runs ${body.version}, this mdeck is ${VERSION}: features added since, such as new activities, need the server updated`)
        : warn('Version', `the server runs ${body.version}, newer than this mdeck (${VERSION})`)]
    const allowed = response.headers.get('access-control-allow-origin')
    results.push(allowed === '*' ? ok('Decks on other sites can reach it', 'CORS is open, as phones and hosted decks need')
      : fail('Decks on other sites can reach it', `the answer has no "Access-Control-Allow-Origin: *" (${allowed ?? 'header missing'}): the web server in front removes or replaces it`))
    return results
  } catch (error) { return [fail('mdeck server', `/info did not answer properly (${why(error)})`)] }
}

// The answers stream must reach the browser as it is written: a proxy that
// collects it first (buffering) leaves slides and phones waiting.
async function streaming(origin, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const name = 'Live updates arrive at once'
  try {
    const response = await fetch(new URL(`/rooms/check-${randomBytes(6).toString('hex')}/events`, origin), { signal: controller.signal })
    if (!/^text\/event-stream/.test(response.headers.get('content-type') ?? '')) return fail(name, `the events route answered ${response.status} ${response.headers.get('content-type') ?? ''}, not an event stream`)
    const { value } = await response.body.getReader().read()
    return /^event: snapshot/m.test(Buffer.from(value ?? []).toString('utf8')) ? ok(name, 'the stream is not held back') : fail(name, 'the stream began with something else than its snapshot')
  } catch (error) {
    return controller.signal.aborted ? fail(name, `nothing arrived within ${timeoutMs / 1000} s: the web server in front buffers the stream. In nginx: proxy_buffering off; proxy_read_timeout 1h;`) : fail(name, `the stream failed (${why(error)})`)
  } finally { clearTimeout(timer); controller.abort() }
}

// With the key the tunnel opens as a presenter's computer would, and closes at
// once. Without it, an answer of the server's own (401, or 404 without a
// key) shows that the upgrade got through; the JSON of the web route does not.
function upgrade(origin, key, timeoutMs) {
  const name = 'WebSocket upgrades pass'
  const url = new URL(`/tunnel/check_${randomBytes(8).toString('hex')}`, origin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return new Promise(done => {
    const socket = new WebSocket(url, { headers: key ? { Authorization: `Bearer ${key}` } : {}, handshakeTimeout: timeoutMs })
    const stop = result => { socket.removeAllListeners(); socket.on('error', () => {}); socket.terminate(); done(result) }
    socket.on('open', () => stop(ok(name, 'the key opened a presenter connection; mdeck run --server works through this address')))
    socket.on('unexpected-response', (request, response) => {
      const own = !response.headers['content-type']
      if (response.statusCode === 429 && own) stop(warn(name, 'the server refuses this address for a minute after too many wrong keys: wait, and check again with the right key'))
      else if (response.statusCode === 401 && own) stop(key ? fail(name, 'the upgrade reaches the server, but it refuses the key: MDECK_SERVER_KEY here differs from the server\'s') : ok(name, 'the upgrade reaches the server (give the key in MDECK_SERVER_KEY to test it fully)'))
      else if (response.statusCode === 404 && own) stop(warn(name, 'the upgrade reaches the server, but it has no key set: presenting from an iPad through it is off until MDECK_SERVER_KEY is set'))
      else stop(fail(name, `the upgrade was answered ${response.statusCode} by the web server in front: it must pass WebSocket connections on. In nginx: proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";`))
    })
    socket.on('error', error => stop(fail(name, `the connection failed (${why(error)})`)))
  })
}

export async function checkServer(origin, { key = null, timeoutMs = 5000 } = {}) {
  const base = new URL(origin).origin
  const { result } = await reach(base, timeoutMs)
  if (result.status === 'fail') return [result]
  const about = await info(base, timeoutMs)
  // Not a mdeck server at all: the rest would only repeat that.
  if (about.length === 1 && about[0].status === 'fail') return [result, ...about]
  return [result, ...about, await streaming(base, timeoutMs), await upgrade(base, key, timeoutMs)]
}
