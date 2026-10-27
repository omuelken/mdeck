// What a standalone `mdeck server` answers outside the rooms: a page at / that
// says what it is and how to use it, /health for monitors and proxies, and
// /status for its operator, who knows the key. The page itself says nothing
// that /info does not; the key is typed into it and sent as a header, never
// as part of the address.
import { CODE_RE } from './code.js'
import { VERSION, clientAddress, createLimiter, isLoopbackAddress, keyMatches } from './rooms.js'

const escapeHtml = text => String(text).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])

// Where this server was reached, as a deck's `server:` names it. Behind a
// proxy on the same machine the forwarded host and protocol are the visitor's.
function originOf(request) {
  const forwarded = isLoopbackAddress(request.socket?.remoteAddress ?? '')
  const host = (forwarded && request.headers['x-forwarded-host']) || request.headers.host || 'localhost'
  const protocol = (forwarded && request.headers['x-forwarded-proto']) || (request.socket?.encrypted ? 'https' : 'http')
  return `${String(protocol).split(',')[0].trim()}://${String(host).split(',')[0].trim()}`
}

const PAGE = ({ origin, notice }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>mdeck server</title>
<style>
  :root { color-scheme: light dark; --bg: #fff; --ink: #1d1d1f; --muted: #6e6e73; --rule: #d8d8dc; --accent: #0d7c72; --warn: #b42318; --code: #f3f3f5; }
  @media (prefers-color-scheme: dark) { :root { --bg: #17181a; --ink: #ececee; --muted: #9a9aa2; --rule: #34353a; --accent: #3fc1b3; --warn: #ff8a80; --code: #222326; } }
  body { margin: 0; padding: 48px 16px; background: var(--bg); color: var(--ink); font: 16px/1.5 system-ui, sans-serif; }
  main { max-width: 560px; margin: 0 auto; }
  h1 { margin: 0 0 4px; font-size: 28px; }
  h2 { margin: 32px 0 8px; font-size: 16px; }
  p { margin: 8px 0; }
  .muted { color: var(--muted); }
  .up::before { content: ""; display: inline-block; width: 9px; height: 9px; margin-right: 8px; border-radius: 50%; background: var(--accent); }
  code, pre { background: var(--code); border-radius: 6px; font: 14px ui-monospace, monospace; }
  code { padding: 1px 6px; }
  pre { margin: 8px 0; padding: 10px 12px; overflow-x: auto; }
  form { display: flex; gap: 8px; margin: 8px 0; }
  input, button { font: inherit; padding: 8px 12px; border: 1px solid var(--rule); border-radius: 8px; background: var(--bg); color: var(--ink); }
  input { flex: 1; min-width: 0; }
  button { cursor: pointer; background: var(--accent); border-color: var(--accent); color: var(--bg); }
  .notice, .error { color: var(--warn); }
  details { margin-top: 32px; border-top: 1px solid var(--rule); padding-top: 12px; }
  details p { font-size: 14px; }
  summary { cursor: pointer; font-weight: 600; }
  table { width: 100%; margin: 12px 0; border-collapse: collapse; font-size: 14px; font-variant-numeric: tabular-nums; }
  th, td { padding: 4px 8px; border-bottom: 1px solid var(--rule); text-align: left; }
  td:not(:first-child), th:not(:first-child) { text-align: right; }
  td:first-child { overflow-wrap: anywhere; }
</style>
</head>
<body>
<main>
  <h1>mdeck server</h1>
  <p class="up muted">Running · version ${escapeHtml(VERSION)}</p>

  <h2>Use it in a deck</h2>
  <p>Set this server in the deck's settings; its polls then work for everyone who opens the deck:</p>
  <pre>server: ${escapeHtml(origin)}</pre>
  <p class="muted">To present from an iPad through it, start <code>mdeck run --server ${escapeHtml(origin)}</code> with the key in <code>MDECK_SERVER_KEY</code>.</p>

  <h2>Join a talk</h2>
  <p>Type the join code shown on the slides:</p>
  <form method="get" action="/">
    <input name="code" inputmode="numeric" pattern="[0-9]{4,8}" autocomplete="off" placeholder="482113" aria-label="Join code" required>
    <button>Join</button>
  </form>${notice ? `\n  <p class="notice">${escapeHtml(notice)}</p>` : ''}

  <details id="status">
    <summary>Server status</summary>
    <p class="muted">For whoever runs this server. The key is the value of <code>MDECK_SERVER_KEY</code> that it was started with: <code>MDECK_SERVER_KEY=… mdeck server</code>, or in the environment file of its service, such as <code>/etc/mdeck-server.env</code>. A server started without one has no status view; set one and restart it. The key is sent to this server only and not kept.</p>
    <form id="unlock"><input id="key" type="password" autocomplete="off" placeholder="Key" aria-label="Key" required><button>Show</button></form>
    <p id="problem" class="error" role="status"></p>
    <div id="report" hidden></div>
  </details>
</main>
<script>
(() => {
  const form = document.getElementById('unlock'), problem = document.getElementById('problem'), report = document.getElementById('report')
  let key = '', timer = 0
  const add = (parent, tag, text, className) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; parent.append(node); return node }
  const row = (table, cells, head) => { const tr = add(table, 'tr'); for (const cell of cells) add(tr, head ? 'th' : 'td', cell) }
  const span = seconds => seconds < 90 ? seconds + ' s' : seconds < 5400 ? Math.round(seconds / 60) + ' min' : Math.round(seconds / 360) / 10 + ' h'
  const show = status => {
    report.replaceChildren()
    const totals = add(report, 'table')
    for (const [label, value] of [
      ['Version', status.version + ' · Node ' + status.node], ['Running for', span(status.uptimeSeconds)], ['Memory', status.memoryMb + ' MB'],
      ['Rooms', status.rooms + ' of ' + status.limits.rooms], ['Messages', status.messages], ['Open connections', status.listeners], ['Pictures held', status.pictures],
      ['Presenting through this server', status.relay.enabled ? status.relay.tunnels + ' open' : 'off (no key set)'],
    ]) row(totals, [label, value])
    if (status.list.length) {
      const rooms = add(report, 'table')
      row(rooms, ['Room', 'Messages', 'Connected', 'Idle'], true)
      for (const room of status.list) row(rooms, [room.room, room.messages, room.listeners, span(room.idleSeconds)])
    }
  }
  const load = async () => {
    clearTimeout(timer)
    try {
      const response = await fetch('/status', { headers: { Authorization: 'Bearer ' + key }, cache: 'no-store' })
      if (!response.ok) throw new Error(response.status === 429 ? 'Too many tries; wait a minute.' : 'The key is wrong, or this server has none set.')
      problem.textContent = ''
      report.hidden = false
      show(await response.json())
      timer = setTimeout(load, 5000)
    } catch (error) { report.hidden = true; problem.textContent = error.message }
  }
  form.addEventListener('submit', event => { event.preventDefault(); key = document.getElementById('key').value; load() })
})()
</script>
</body>
</html>
`

const text = (response, status, body, type = 'text/plain; charset=utf-8', headers = {}) => {
  response.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...headers })
  response.end(body)
}

/**
 * The routes of a standalone server beyond its rooms: returns a function that
 * answers a request and says whether it was one of them.
 */
export function infoRoutes({ rooms, tunnels, key = null, started = Date.now(), tries = createLimiter({ burst: 10, perMs: 60000 }) }) {
  return (request, response) => {
    const { pathname, searchParams } = new URL(request.url, 'http://localhost')
    const reads = request.method === 'GET' || request.method === 'HEAD'
    if (!reads || !['/', '/health', '/status'].includes(pathname)) return false
    const send = (status, body, type, headers) => text(response, status, request.method === 'HEAD' ? undefined : body, type, headers)
    if (pathname === '/health') { send(200, 'ok\n'); return true }
    if (pathname === '/status') {
      // Without a key set there is nothing to unlock: the route does not exist.
      if (!key) { send(404, JSON.stringify({ error: 'Not found' }), 'application/json; charset=utf-8'); return true }
      if (!tries(clientAddress(request))) { send(429, JSON.stringify({ error: 'Too many tries; wait a minute' }), 'application/json; charset=utf-8'); return true }
      if (!keyMatches(request, key)) { send(401, JSON.stringify({ error: 'The key is wrong' }), 'application/json; charset=utf-8'); return true }
      const memory = process.memoryUsage().rss
      send(200, JSON.stringify({ version: VERSION, node: process.versions.node, uptimeSeconds: Math.round((Date.now() - started) / 1000), memoryMb: Math.round(memory / 1048576), ...rooms.stats(), relay: { enabled: true, tunnels: tunnels.size } }), 'application/json; charset=utf-8')
      return true
    }
    // A join code typed on this page leads to that talk's answer page.
    const code = searchParams.get('code')?.trim()
    if (code && CODE_RE.test(code)) { response.writeHead(302, { Location: `/${code}`, 'Cache-Control': 'no-store' }); response.end(); return true }
    send(200, PAGE({ origin: originOf(request), notice: code ? 'A join code has 4 to 8 digits.' : '' }), 'text/html; charset=utf-8', {
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    })
    return true
  }
}
