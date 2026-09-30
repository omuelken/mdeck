// Launch page API for `mdeck dev`: what the deck contains, what `mdeck check`
// says about it, the state of its room server, and buttons that start the
// editor and the guides or run a build. Like the editor API it answers loopback
// requests from its own pages only, even when the server is shared on the
// network for phones.
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { loadRegistry } from '../extensions/discover.js'
import { parseSlides } from '../core/parseSlides.js'
import { checkDeck } from './check.js'
import { sessionCode } from '../live/code.js'
import { roomsIn } from '../live/roomTag.js'
import { isAllowedRequest, send, readJson } from './editorPlugin.js'
import { findChrome } from './chrome.js'
import { frameworkRoot } from '../paths.js'

// Each output is one ordinary CLI run beside the deck, so the launch page
// builds exactly what the command line would.
export function outputsFor(slidesPath) {
  const abs = resolve(slidesPath), dir = dirname(abs), name = basename(abs).replace(/\.md$/i, '')
  return {
    folder: { title: 'Folder to host', args: ['build', abs], file: resolve(dir, 'dist/index.html') },
    share: { title: 'One file to send', args: ['build', abs, '--share', '--self-contained', '-o', `${name}.html`], file: resolve(dir, `${name}.html`), chrome: true },
    pdf: { title: 'PDF', args: ['pdf', abs, '-o', `${name}.pdf`], file: resolve(dir, `${name}.pdf`), chrome: true },
  }
}

export function runCli(args, cwd) {
  return new Promise(done => {
    const child = spawn(process.execPath, [resolve(frameworkRoot, 'bin/mdeck.js'), ...args], { cwd, env: { ...process.env, FORCE_COLOR: '0' }, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    child.stdout.on('data', data => { output += data })
    child.stderr.on('data', data => { output += data })
    child.on('error', error => done({ code: 1, output: error.message }))
    child.on('close', code => done({ code, output: output.replace(/\x1b\[[0-9;]*m/g, '').trim() }))
  })
}

function reveal(file) {
  const [command, args] = process.platform === 'darwin' ? ['open', ['-R', file]]
    : process.platform === 'win32' ? ['explorer', [`/select,${file}`]]
    : ['xdg-open', [dirname(file)]]
  spawn(command, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref()
}

// The room server named in `live.server`: whether it answers, and whether it
// accepts the presenter code (MDECK_LIVE_KEY, as given to the room server).
export async function liveStatus(live, { key = null, fetch: get = fetch, timeoutMs = 2500 } = {}) {
  const started = Date.now()
  try {
    const response = await get(`${live.server.replace(/\/+$/, '')}/info`, { headers: key ? { Authorization: `Bearer ${key}` } : {}, signal: AbortSignal.timeout(timeoutMs) })
    if (!response.ok) return { reachable: false, error: `It answered with status ${response.status}` }
    const body = await response.json()
    return { reachable: true, ms: Date.now() - started, keyAccepted: key ? !!body.canReset : null }
  } catch (error) {
    return { reachable: false, error: error.name === 'TimeoutError' ? `No answer within ${timeoutMs / 1000} s` : error.cause?.code ?? error.message }
  }
}

// `urls()` returns the server's addresses; `services` start the editor and the
// guides; `fetch` reaches the room server. All are injected so tests can run
// without a browser or network.
export function homeMiddleware(slidesPath, { urls = () => ({ local: [], network: [] }), services = {}, pairing = null, run = runCli, open = reveal, liveKey = process.env.MDECK_LIVE_KEY || null, fetch: get = fetch } = {}) {
  const abs = resolve(slidesPath)
  const outputs = outputsFor(abs)
  const jobs = {}
  const started = {}, serviceUrls = {}

  async function info(request) {
    const source = readFileSync(abs, 'utf8')
    let registry = null, registryError = null
    try { registry = loadRegistry(abs) } catch (error) { registryError = error.message }
    const { deck, diagnostics } = registry ? checkDeck(abs, registry, source) : { deck: parseSlides(source), diagnostics: [] }
    const config = deck.deckConfig ?? {}
    const { local: serverLocal = [], network = [] } = urls() ?? {}
    // The address this page was opened with, such as a local proxy's name.
    const local = request?.headers?.host ? [`http://${request.headers.host}/`, ...serverLocal] : serverLocal
    return {
      file: abs,
      name: basename(abs),
      modified: statSync(abs).mtime.toISOString(),
      title: config.meta?.title ?? basename(abs).replace(/\.md$/i, ''),
      author: config.meta?.author ?? null,
      slides: deck.slides.length,
      width: config.width ?? 1920,
      height: config.height ?? 1080,
      notes: deck.slides.filter(slide => slide.meta.notes || slide.meta.note).length,
      design: config.design ?? 'neue',
      palette: config.palette ?? null,
      diagnostics: [...(registry?.warnings ?? []).map(message => ({ severity: 'warning', code: 'extension', message })), ...(registryError ? [{ severity: 'error', code: 'extension', message: registryError }] : []), ...diagnostics],
      live: await live(config, source, { local, network }),
      // Presenting from an iPad needs an address it can reach (`--host`).
      pairing: pairing ? { available: !!network[0], devices: pairing.devices } : null,
      chrome: !!findChrome(),
      services: Object.fromEntries(Object.keys(services).map(key => [key, serviceUrls[key] ?? null])),
      outputs: Object.fromEntries(Object.entries(outputs).map(([key, output]) => [key, {
        title: output.title,
        file: output.file,
        exists: existsSync(output.file),
        needsChrome: !!output.chrome,
        ...(jobs[key] ?? { status: 'idle' }),
      }])),
    }
  }

  // Decks with activities, or with a room server of their own, get this
  // section: the room server and its health, the join link phones open and,
  // for a room server of their own, the presenter code.
  async function live(config, source, { local, network }) {
    const settings = config.live ?? {}
    const own = typeof settings.server === 'string'
    if (!own && roomsIn(source).length === 0) return null
    const code = sessionCode(config)
    const builtIn = base => new URL(`__mdeck/live/${code}`, base).href
    const joinUrl = own ? `${settings.server.replace(/\/+$/, '')}/${code}` : network[0] ? builtIn(network[0]) : null
    return {
      server: own ? settings.server : null,
      code,
      ...(own ? await liveStatus(settings, { key: liveKey, fetch: get }) : { reachable: true }),
      key: own ? liveKey : null,
      joinUrl,
      localJoinUrl: joinUrl ?? (local[0] ? builtIn(local[0]) : null),
    }
  }

  // Each service starts once; a failed start can be retried.
  async function start(key) {
    started[key] ??= services[key]().then(service => { serviceUrls[key] = service.url; return service }, error => { delete started[key]; throw error })
    return (await started[key]).url
  }

  // The one-time address an iPad opens to present from: the presenter view,
  // with the presenter code of the deck's own room server if there is one.
  function pairUrl() {
    const network = urls()?.network?.[0]
    if (!pairing || !network) throw Object.assign(new Error('Start mdeck dev with --host so an iPad can reach it'), { status: 409 })
    const url = new URL(network)
    url.searchParams.set('view', 'presenter')
    url.searchParams.set('pair', pairing.offer())
    const config = parseSlides(readFileSync(abs, 'utf8')).deckConfig ?? {}
    if (typeof config.live?.server === 'string' && liveKey) url.searchParams.set('livekey', liveKey)
    return url.href
  }

  async function act({ action, output } = {}) {
    if (Object.hasOwn(services, action)) return { url: await start(action) }
    if (action === 'pair') return { url: pairUrl() }
    if (action === 'unpair') { pairing?.revoke(); return { ok: true } }
    if (action === 'build') {
      if (!Object.hasOwn(outputs, output)) throw Object.assign(new Error(`Unknown output: ${output}`), { status: 400 })
      if (jobs[output]?.status === 'running') throw Object.assign(new Error('That build is already running'), { status: 409 })
      jobs[output] = { status: 'running', startedAt: new Date().toISOString() }
      const { code, output: log } = await run(outputs[output].args, dirname(abs))
      jobs[output] = { status: code === 0 ? 'done' : 'failed', log, finishedAt: new Date().toISOString() }
      return jobs[output]
    }
    if (action === 'reveal') {
      const target = outputs[output]?.file ?? (output === 'deck' ? abs : null)
      if (!target || !existsSync(target)) throw Object.assign(new Error('Nothing to show yet'), { status: 404 })
      open(target)
      return { ok: true }
    }
    throw Object.assign(new Error(`Unknown action: ${action}`), { status: 400 })
  }

  return async (request, response, next) => {
    const pathname = new URL(request.url, 'http://localhost').pathname
    if (!['/info', '/action'].includes(pathname)) return next()
    if (!isAllowedRequest(request)) return send(response, 403, { error: 'The launch page only answers on this computer' })
    try {
      if (pathname === '/info' && request.method === 'GET') return send(response, 200, await info(request))
      if (pathname === '/action' && request.method === 'POST') return send(response, 200, await act(await readJson(request)))
      response.setHeader('Allow', pathname === '/info' ? 'GET' : 'POST')
      return send(response, 405, { error: 'Method not allowed' })
    } catch (error) {
      return send(response, error.status ?? 500, { error: error.message })
    }
  }
}

export function homePlugin(slidesPath, { services, pairing } = {}) {
  return {
    name: 'vite-plugin-mdeck-home',
    configureServer(server) {
      // The bare address is the launch page; the slides are at ?view=deck.
      // Only a plain page visit is redirected: every view, preview and editor
      // frame carries a query.
      server.middlewares.use((request, response, next) => {
        if (request.method !== 'GET' || !['/', '/index.html'].includes(request.url) || !/text\/html/.test(request.headers.accept ?? '')) return next()
        response.writeHead(302, { Location: '/home.html' })
        response.end()
      })
      server.middlewares.use('/__mdeck/home', homeMiddleware(slidesPath, { urls: () => server.resolvedUrls, services, pairing }))
    },
  }
}
