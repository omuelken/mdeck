// Real-browser check of `mdeck run --server`: a local server, the dev
// server tunnelled through it, and Chrome as the iPad.  npm run test:server
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { launchChrome } from '../src/build/chrome.js'

const root = resolve(fileURLToPath(import.meta.url), '../..')
const freePort = () => new Promise(done => { const probe = createServer(); probe.listen(0, '127.0.0.1', () => { const { port } = probe.address(); probe.close(() => done(port)) }) })
const temp = mkdtempSync(resolve(tmpdir(), 'server-e2e-'))
const KEY = 'e2e-key-0123456789'
const ROOM_PORT = await freePort(), DEV_PORT = await freePort()
const ROOM = `http://127.0.0.1:${ROOM_PORT}`
const kids = []
const run = (name, args, env = {}) => {
  const child = spawn(process.execPath, args, { cwd: root, env: { ...process.env, ...env } })
  let out = ''
  child.stdout.on('data', d => { out += d }); child.stderr.on('data', d => { out += d })
  kids.push(child)
  return { child, out: () => out }
}
const until = async (fn, what, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = await fn(); if (v) return v; await delay(100) } throw new Error('timeout: ' + what) }
let browser
try {
  const deck = resolve(temp, 'deck.md')
  const source = n => `---\ntheme: neue\nmeta:\n  title: Server test\nserver: ${ROOM}\n---\n\n${Array.from({ length: n }, (_, i) => `---\nid: s${i + 1}\n---\n# Slide ${i + 1}\n`).join('\n')}`
  writeFileSync(deck, source(2))
  const live = run('live', ['bin/mdeck.js', 'server', '--port', String(ROOM_PORT)], { MDECK_SERVER_KEY: KEY })
  await until(() => /Server:/.test(live.out()), 'server')
  const dev = run('run', ['bin/mdeck.js', 'run', deck, '--server', '--no-open', '--port', String(DEV_PORT)], { MDECK_SERVER_KEY: KEY })
  await until(() => /Connected to/.test(dev.out()), 'tunnel up')
  const url = dev.out().match(/opens (http\S+)/)[1]
  const base = new URL(url).pathname

  // The launch page, on this computer, under the base path.
  const home = `http://localhost:${DEV_PORT}${base}`
  const info = await (await fetch(`${home}__mdeck/home/info`)).json()
  assert.equal(info.relay.state, 'up'); assert.equal(info.pairing.available, true)
  const offered = await (await fetch(`${home}__mdeck/home/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'pair' }) })).json()
  assert.ok(offered.url.startsWith(url + '?view=presenter&pair='), offered.url)

  // The launch page and the editor are not reachable through the server.
  for (const path of ['home.html', '__mdeck/home/info', '__mdeck/deck']) assert.equal((await fetch(`${ROOM}${base}${path}`)).status, 403, path)

  browser = await launchChrome({ dir: temp, timeout: 45000 })
  // the iPad
  const ipad = await browser.open(offered.url)
  await until(() => ipad.evaluate("document.body.innerText.includes('Speaker View') || document.body.innerText.includes('/ 02')"), 'presenter view renders')
  await until(() => ipad.evaluate("(() => { try { return !!document.querySelector('iframe').contentDocument.querySelector('deck-stage') } catch { return false } })()"), 'deck inside presenter')
  const token = await ipad.evaluate("localStorage.getItem('mdeck-pair:' + location.origin)")
  assert.ok(token && token.length > 20, 'the iPad paired')
  assert.ok(!(await ipad.evaluate('location.href')).includes('pair='), 'the one-time token left the address')
  // paired: ink API answers; unpaired: refused
  const inkAs = auth => ipad.evaluate(`fetch(location.pathname + '__mdeck/ink', { headers: ${auth ? `{ Authorization: 'Bearer ${token}' }` : '{}'} }).then(r => r.status)`)
  assert.equal(await inkAs(true), 200); assert.equal(await inkAs(false), 403, 'unpaired requests through the tunnel are refused')
  // the server lets the paired iPad steer
  assert.equal(await (await fetch(`${ROOM}/info`, { headers: { Authorization: `Bearer ${token}` } })).json().then(j => j.canReset), true)
  assert.equal(await (await fetch(`${ROOM}/info`)).json().then(j => j.canReset), false)
  // live reload crosses the tunnel: add a slide on the laptop
  writeFileSync(deck, source(3))
  await until(() => ipad.evaluate("document.body.innerText.includes('/ 03') || (() => { try { return document.querySelector('iframe').contentDocument.querySelector('deck-stage').length === 3 } catch { return false } })()"), 'iPad reloads after an edit', 25000)
  // the launch page under the base path
  const launch = await browser.open(`${home}home.html`)
  await until(() => launch.evaluate("document.body.innerText.toLowerCase().includes('present from an ipad')"), 'launch page renders', 8000)
  await until(() => launch.evaluate("document.body.innerText.toLowerCase().includes('connected to your server')"), 'connection status shown')
  // Loading the iPad's pages asked for nothing that is kept private (the three above were asked for on purpose).
  const refused = dev.out().split('\n').filter(line => /not shared/.test(line) && !/home\.html|__mdeck\/home\/info|__mdeck\/deck/.test(line))
  assert.deepEqual(refused, [])
  console.log('Server check passed: pairing through the server, refused addresses, paired-only ink, live reload, launch page.')
} catch (error) { console.error('Share check failed:', error.message); process.exitCode = 1 }
finally { await browser?.close?.(); for (const k of kids) k.kill(); rmSync(temp, { recursive: true, force: true }) }
