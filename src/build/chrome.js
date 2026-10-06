// Headless Chrome over the DevTools protocol, used for PDF rendering and
// screenshots. Serves a folder over loopback so relative assets resolve.
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { resolve, extname, relative, isAbsolute } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const CANDIDATES = {
  darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
  linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium'],
  win32: ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'],
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2', '.woff': 'font/woff', '.pdf': 'application/pdf' }

export function findChrome() {
  if (process.env.MDECK_CHROME) return existsSync(process.env.MDECK_CHROME) ? process.env.MDECK_CHROME : null
  return (CANDIDATES[process.platform] ?? []).find(existsSync) ?? null
}

export function serveDirectory(root) {
  return createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
      const file = resolve(root, '.' + pathname)
      const rel = relative(root, file)
      if (rel.startsWith('..') || isAbsolute(rel) || !statSync(file).isFile()) throw new Error('not found')
      response.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream' })
      response.end(readFileSync(file))
    } catch { response.writeHead(404); response.end() }
  })
}

// Starts Chrome and a static server for `dir`. `open(path)` returns a page
// with evaluate(), send() and waitFor(); call close() when done.
export async function launchChrome({ dir, chrome = findChrome(), timeout = 90000 } = {}) {
  if (!chrome) throw new Error('No Chrome or Chromium found. Set MDECK_CHROME to its executable path.')
  const temp = mkdtempSync(resolve(tmpdir(), 'mdeck-chrome-'))
  const server = serveDirectory(dir)
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  const origin = `http://127.0.0.1:${server.address().port}`
  const flags = ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--remote-debugging-port=0', `--user-data-dir=${resolve(temp, 'profile')}`,
    // Every tab keeps rendering, like the separate windows of a talk: Chrome
    // otherwise pauses tabs behind the front one, and an input event or an
    // animation frame there waited for a frame that did not come.
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows']
  // Chrome refuses to start as root with its sandbox on, as in CI containers.
  if (process.getuid?.() === 0) flags.push('--no-sandbox')
  const browser = spawn(chrome, [...flags, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] })
  const pending = new Map()
  let socket
  // `timeout` limits each step (starting Chrome, each command), not the whole
  // session: a long job with many quick steps must not fail at an arbitrary
  // step once a total budget runs out.
  const close = async () => {
    for (const task of pending.values()) clearTimeout(task.timer)
    socket?.close()
    server.close()
    if (browser.exitCode === null) { browser.kill(); await new Promise(done => browser.once('exit', done)) }
    // Chrome's helper processes may still write to the profile for a moment
    // after the browser exits; retry, and never fail a finished job over a
    // temporary folder.
    try { rmSync(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }) } catch {}
  }
  try {
    const endpoint = await new Promise((resolveEndpoint, reject) => {
      let log = ''
      const startup = setTimeout(() => reject(new Error('Timed out while starting Chrome')), timeout)
      browser.on('error', reject)
      browser.on('exit', code => reject(new Error(`Chrome exited early (${code})`)))
      browser.stderr.on('data', data => { log += data; const match = log.match(/DevTools listening on (ws:\/\/\S+)/); if (match) { clearTimeout(startup); resolveEndpoint(match[1]) } })
    })
    socket = new WebSocket(endpoint)
    await new Promise((done, reject) => { socket.addEventListener('open', done, { once: true }); socket.addEventListener('error', reject, { once: true }) })
    let nextId = 0
    socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data)
      if (!message.id) return
      const task = pending.get(message.id)
      pending.delete(message.id)
      clearTimeout(task?.timer)
      if (message.error) task?.reject(new Error(message.error.message))
      else task?.resolve(message.result)
    })
    const send = (method, params = {}, sessionId) => new Promise((resolveTask, reject) => {
      const id = ++nextId
      // Where the command came from, so a timeout names the step that hung.
      const caller = new Error().stack?.split('\n').slice(2).find(line => !line.includes('/src/build/chrome.js'))?.trim() ?? ''
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out while driving Chrome: ${method} did not answer within ${timeout / 1000} s ${caller}`)) }, timeout)
      pending.set(id, { resolve: resolveTask, reject, timer })
      socket.send(JSON.stringify({ id, method, params, sessionId }))
    })
    const open = async path => {
      const url = path.startsWith('http') ? path : origin + '/' + path.replace(/^\//, '')
      const { targetId } = await send('Target.createTarget', { url })
      const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
      const page = {
        url, sessionId,
        send: (method, params) => send(method, params, sessionId),
        async evaluate(expression) {
          const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId)
          if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
          return result.result.value
        },
        async waitFor(expression, { attempts = 600, interval = 100 } = {}) {
          for (let attempt = 0; attempt < attempts; attempt++) {
            if (await page.evaluate(expression)) return true
            await delay(interval)
          }
          return false
        },
        // Waits until the deck stage exists, fonts are loaded and images decoded.
        waitForDeck: () => page.waitFor("document.querySelector('deck-stage')?.length > 0 && document.fonts.status === 'loaded' && [...document.images].every(image => image.complete)"),
        async screenshot({ width = 1600, height = 900, scale = 1 } = {}) {
          await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false }, sessionId)
          await delay(150)
          const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId)
          return Buffer.from(data, 'base64')
        },
        close: () => send('Target.closeTarget', { targetId }),
      }
      return page
    }
    return { origin, open, close }
  } catch (error) {
    await close()
    throw error
  }
}
