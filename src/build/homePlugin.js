// Launch page API for `mdeck dev`: what the deck contains, what `mdeck check`
// says about it, where to open each view, and buttons that start the editor
// and the guides or run a build. Like the editor API it answers loopback
// requests from its own pages only, even when the server is shared on the
// network for phones.
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import QRCode from 'qrcode'
import { loadRegistry } from '../extensions/discover.js'
import { parseSlides } from '../core/parseSlides.js'
import { checkDeck } from './check.js'
import { componentFiles } from './components.js'
import { isAllowedRequest, send, readJson } from './editorPlugin.js'
import { findChrome } from './chrome.js'
import { frameworkRoot } from '../paths.js'

const BUILT_IN_COMPONENTS = [
  { tag: 'codeblock', example: '```python live copy\nprint("hello")\n```' },
  { tag: 'qrcode', example: '<qrcode url="https://example.org" size="240" />' },
  { tag: 'videoplayer', example: '<videoplayer src="./media/clip.mp4" />' },
  { tag: 'poll', example: '<poll room="lunch" options="Mensa|Thai|Pizza" />' },
]

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

function starterFor(record) {
  return record.manifest.starter ?? `---\nlayout: ${record.id}\n---\n`
}

// `urls()` returns the server's addresses; `services` start the editor and the
// guides. Both are injected so tests can run without a browser or network.
export function homeMiddleware(slidesPath, { urls = () => ({ local: [], network: [] }), services = {}, run = runCli, open = reveal } = {}) {
  const abs = resolve(slidesPath)
  const outputs = outputsFor(abs)
  const jobs = {}
  const started = {}, serviceUrls = {}

  async function info() {
    const source = readFileSync(abs, 'utf8')
    let registry = null, registryError = null
    try { registry = loadRegistry(abs) } catch (error) { registryError = error.message }
    const { deck, diagnostics } = registry ? checkDeck(abs, registry, source) : { deck: parseSlides(source), diagnostics: [] }
    const config = deck.deckConfig ?? {}
    const { local = [], network = [] } = urls() ?? {}
    const phoneUrl = network[0] ?? null
    const records = kind => Object.values(registry?.[`${kind}s`] ?? {})
    return {
      file: abs,
      name: basename(abs),
      modified: statSync(abs).mtime.toISOString(),
      title: config.meta?.title ?? basename(abs).replace(/\.md$/i, ''),
      author: config.meta?.author ?? null,
      slides: deck.slides.length,
      notes: deck.slides.filter(slide => slide.meta.notes || slide.meta.note).length,
      design: config.design ?? 'neue',
      palette: config.palette ?? null,
      diagnostics: [...(registry?.warnings ?? []).map(message => ({ severity: 'warning', code: 'extension', message })), ...(registryError ? [{ severity: 'error', code: 'extension', message: registryError }] : []), ...diagnostics],
      layouts: records('template').map(record => ({ id: record.id, title: record.title, description: record.description ?? '', source: record.source, starter: starterFor(record) })),
      themes: records('theme').map(record => ({ id: record.id, title: record.title, description: record.description ?? '', source: record.source })),
      palettes: records('palette').map(record => ({ id: record.id, title: record.title, description: record.description ?? '', source: record.source })),
      components: [
        ...componentFiles(abs).map(({ tag, source, folder }) => ({ tag, source, folder, example: `<${tag} />` })),
        ...BUILT_IN_COMPONENTS.map(component => ({ ...component, source: 'built-in' })),
      ],
      urls: { local: local[0] ?? null, network: phoneUrl },
      phoneQr: phoneUrl ? await QRCode.toString(new URL('?view=share', phoneUrl).href, { type: 'svg', margin: 1 }) : null,
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

  // Each service starts once; a failed start can be retried.
  async function start(key) {
    started[key] ??= services[key]().then(service => { serviceUrls[key] = service.url; return service }, error => { delete started[key]; throw error })
    return (await started[key]).url
  }

  async function act({ action, output } = {}) {
    if (Object.hasOwn(services, action)) return { url: await start(action) }
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
      if (pathname === '/info' && request.method === 'GET') return send(response, 200, await info())
      if (pathname === '/action' && request.method === 'POST') return send(response, 200, await act(await readJson(request)))
      response.setHeader('Allow', pathname === '/info' ? 'GET' : 'POST')
      return send(response, 405, { error: 'Method not allowed' })
    } catch (error) {
      return send(response, error.status ?? 500, { error: error.message })
    }
  }
}

export function homePlugin(slidesPath, { services } = {}) {
  return {
    name: 'vite-plugin-mdeck-home',
    configureServer(server) {
      server.middlewares.use('/__mdeck/home', homeMiddleware(slidesPath, { urls: () => server.resolvedUrls, services }))
    },
  }
}
