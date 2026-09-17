// Optional real-browser regression check. No browser automation dependency.
// MDECK_CHROME=/path/to/chrome npm run test:browser
import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'
import { setTimeout as delay } from 'node:timers/promises'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const chrome = process.env.MDECK_CHROME ?? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync)
if (!chrome) throw new Error('Set MDECK_CHROME to a Chrome/Chromium executable')
const temp = mkdtempSync(resolve(tmpdir(), 'mdeck-browser-check-'))
let browser, server, socket
const pending = new Map()
const deadline = setTimeout(() => { console.error('Browser check timed out'); browser?.kill(); process.exitCode = 1; server?.close(); socket?.close() }, 45000)
try {
  const output = resolve(temp, 'deck.html')
  execFileSync(process.execPath, ['bin/mdeck.js', 'build', 'examples/custom-templates/slides.md', '-o', output], { cwd: root, stdio: 'pipe' })
  const html = readFileSync(output)
  server = createServer((request, response) => { response.writeHead(200, { 'Content-Type': 'text/html' }); response.end(html) })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${server.address().port}/deck.html`
  browser = spawn(chrome, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${resolve(temp, 'profile')}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] })
  const endpoint = await new Promise((resolve, reject) => {
    let log = ''
    browser.on('error', reject)
    browser.on('exit', code => reject(new Error(`Chrome exited early (${code})`)))
    browser.stderr.on('data', data => { log += data; const match = log.match(/DevTools listening on (ws:\/\/\S+)/); if (match) resolve(match[1]) })
  })
  socket = new WebSocket(endpoint)
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
  let nextId = 0
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    if (!message.id) return
    const task = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) task?.reject(new Error(message.error.message))
    else task?.resolve(message.result)
  })
  function send(method, params = {}, sessionId) {
    const id = ++nextId
    return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params, sessionId })) })
  }
  async function target(targetUrl) {
    const { targetId } = await send('Target.createTarget', { url: targetUrl })
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
    return sessionId
  }
  async function evaluate(session, expression) {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, session)
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
    return result.result.value
  }
  async function until(session, expression) {
    for (let attempt = 0; attempt < 150; attempt++) {
      if (await evaluate(session, expression)) return
      await delay(50)
    }
    throw new Error(`Condition did not become true: ${expression}`)
  }
  const presenter = await target(url + '?view=presenter')
  const stage = "document.querySelector('iframe')?.contentWindow?.document.querySelector('deck-stage')"
  await until(presenter, `${stage}?.length === 2`)
  // Let Preact install the presenter's event listeners.
  await delay(200)
  const session = await evaluate(presenter, "new URL(location.href).searchParams.get('session')")
  assert.ok(session)
  const audience = await target(url + '?view=audience&session=' + session)
  const other = await target(url + '?view=audience&session=another-session')
  const audienceStage = "document.querySelector('deck-stage')"
  await until(audience, `${audienceStage}?.length === 2`)
  await until(other, `${audienceStage}?.length === 2`)
  assert.equal(await evaluate(audience, "document.querySelector('.slide--comparison [data-region=left]')?.textContent.includes('Directory bundle')"), true)
  await evaluate(presenter, `${stage}.goTo(1); ${stage}.next()`)
  await until(audience, `${audienceStage}.state.index === 1 && ${audienceStage}.state.step === 0`)
  assert.equal(await evaluate(audience, "document.querySelectorAll('[data-step-visible]').length"), 1)
  assert.equal(await evaluate(other, `${audienceStage}.state.index`), 0)
  await evaluate(presenter, `${stage}.prev()`)
  await until(audience, `${audienceStage}.state.step === -1`)
  await evaluate(presenter, `${stage}.reset()`)
  await until(audience, `${audienceStage}.state.index === 0`)
  console.log('Browser checks passed: custom template rendering, reveal/undo/reset synchronization, session isolation.')
} finally {
  clearTimeout(deadline)
  socket?.close()
  server?.close()
  if (browser && browser.exitCode === null) {
    browser.kill()
    await new Promise(resolve => browser.once('exit', resolve))
  }
  rmSync(temp, { recursive: true, force: true })
}
