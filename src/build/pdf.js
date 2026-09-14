// Renders a built deck to PDF with a local headless Chrome, using the deck's
// own print rules: one slide per page at the design size, vector text.
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { resolve, dirname, basename, extname, relative, isAbsolute } from 'node:path'
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

function serveDirectory(root) {
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

export async function renderPdf({ htmlFile, output, chrome = findChrome(), timeout = 90000 }) {
  if (!chrome) throw new Error('No Chrome or Chromium found. Set MDECK_CHROME to its executable path.')
  const html = resolve(htmlFile)
  const temp = mkdtempSync(resolve(tmpdir(), 'mdeck-pdf-'))
  const server = serveDirectory(dirname(html))
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  const url = `http://127.0.0.1:${server.address().port}/${encodeURIComponent(basename(html))}?view=deck&embedded=1`
  const browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--remote-debugging-port=0', `--user-data-dir=${resolve(temp, 'profile')}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] })
  let socket
  const pending = new Map()
  const deadline = setTimeout(() => { for (const task of pending.values()) task.reject(new Error('Timed out while rendering the PDF')) }, timeout)
  try {
    const endpoint = await new Promise((resolveEndpoint, reject) => {
      let log = ''
      browser.on('error', reject)
      browser.on('exit', code => reject(new Error(`Chrome exited early (${code})`)))
      browser.stderr.on('data', data => { log += data; const match = log.match(/DevTools listening on (ws:\/\/\S+)/); if (match) resolveEndpoint(match[1]) })
    })
    socket = new WebSocket(endpoint)
    await new Promise((done, reject) => { socket.addEventListener('open', done, { once: true }); socket.addEventListener('error', reject, { once: true }) })
    let nextId = 0
    socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data)
      if (!message.id) return
      const task = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) task?.reject(new Error(message.error.message))
      else task?.resolve(message.result)
    })
    const send = (method, params = {}, sessionId) => new Promise((resolveTask, reject) => { const id = ++nextId; pending.set(id, { resolve: resolveTask, reject }); socket.send(JSON.stringify({ id, method, params, sessionId })) })
    const { targetId } = await send('Target.createTarget', { url })
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId)
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
      return result.result.value
    }
    for (let attempt = 0; attempt < 600; attempt++) {
      if (await evaluate("document.querySelector('deck-stage')?.length > 0 && document.fonts.status === 'loaded' && [...document.images].every(image => image.complete)")) break
      await delay(100)
    }
    await delay(300)
    const { data } = await send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 }, sessionId)
    writeFileSync(output, Buffer.from(data, 'base64'))
    return output
  } finally {
    clearTimeout(deadline)
    socket?.close()
    server.close()
    if (browser.exitCode === null) { browser.kill(); await new Promise(done => browser.once('exit', done)) }
    rmSync(temp, { recursive: true, force: true })
  }
}

// Points the share view at the PDF: a relative link for folders, an embedded
// data URI for single files.
export function attachPdf(htmlFile, pdfFile, { embed = false } = {}) {
  const html = readFileSync(htmlFile, 'utf8').replace(/<link rel="alternate" type="application\/pdf"[^>]*>/, '')
  const href = embed ? `data:application/pdf;base64,${readFileSync(pdfFile).toString('base64')}` : encodeURIComponent(basename(pdfFile))
  const link = `<link rel="alternate" type="application/pdf" href="${href}">`
  writeFileSync(htmlFile, html.includes('</head>') ? html.replace('</head>', `${link}</head>`) : link + html)
}
