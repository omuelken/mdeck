// Real-browser check of `mdeck run --server`: a local server, the dev
// server tunnelled through it, and Chrome as the iPad.  npm run test:server
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
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
const stageState = async () => {
  const response = await fetch(`${ROOM}/rooms/123456.stage/events`)
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let event = ''
  try {
    while (!event.includes('\n\n')) event += decoder.decode((await reader.read()).value, { stream: true })
    return JSON.parse(event.match(/^data: (.+)$/m)[1]).state
  } finally { await reader.cancel() }
}
let browser, devLog = () => ''
try {
  const deck = resolve(temp, 'deck.md')
  for (const file of ['private.toml', 'private.js', 'confidential.pdf']) writeFileSync(resolve(temp, file), 'PRIVATE_FIXTURE')
  writeFileSync(resolve(temp, 'photo.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>')
  writeFileSync(resolve(temp, 'css-photo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>')
  const extension = resolve(temp, 'extensions/demo')
  mkdirSync(extension, { recursive: true })
  writeFileSync(resolve(extension, 'extension.toml'), 'schema = 1\nkind = "layout"\nid = "demo"\ntitle = "Demo"\n[regions.body]\n')
  writeFileSync(resolve(extension, 'layout.jsx'), 'import { MarkdownRegion } from "mdeck/layout"; export default ({ regions }) => <div class="relay-custom-layout"><MarkdownRegion region={regions.body}/></div>')
  writeFileSync(resolve(extension, 'styles.css'), '.relay-custom-layout { background-image: url("../../css-photo.svg"); }')
  const source = n => `---\ntheme: neue\nmeta:\n  title: Server test\nsession:\n  code: "123456"\nserver: ${ROOM}\n---\n\n${Array.from({ length: n }, (_, i) => `---\nid: s${i + 1}\nlayout: demo\n---\n# Slide ${i + 1}\n\n![Photo](./photo.svg)\n${i === 1 ? '\n:::steps\n- First point\n- Second point\n:::\n' : ''}`).join('\n')}`
  writeFileSync(deck, source(2))
  const live = run('live', ['bin/mdeck.js', 'server', '--port', String(ROOM_PORT)], { MDECK_SERVER_KEY: KEY })
  await until(() => /Server:/.test(live.out()), 'server')
  const dev = run('run', ['bin/mdeck.js', 'run', deck, '--server', '--no-open', '--port', String(DEV_PORT)], { MDECK_SERVER_KEY: KEY })
  await until(() => /Connected to/.test(dev.out()), 'tunnel up')
  const url = dev.out().match(/opens (http\S+)/)[1]
  devLog = dev.out
  const base = new URL(url).pathname

  // The launch page, on this computer, under the base path.
  const home = `http://localhost:${DEV_PORT}${base}`
  const info = await (await fetch(`${home}__mdeck/home/info`)).json()
  assert.equal(info.relay.state, 'up'); assert.equal(info.pairing.available, true)
  const offered = await (await fetch(`${home}__mdeck/home/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'pair' }) })).json()
  assert.equal(new URL(offered.url).searchParams.has('serverkey'), false)
  assert.ok(offered.url.startsWith(url + '?view=presenter&pair='), offered.url)

  // The launch page and the editor are not reachable through the server.
  for (const path of ['home.html', '__mdeck/home/info', '__mdeck/deck', 'private.toml', 'private.js?raw', 'confidential.pdf', '@id/__x00__private', `@fs${temp}/private.js?raw`]) assert.equal((await fetch(`${ROOM}${base}${path}`)).status, 403, path)

  browser = await launchChrome({ dir: temp, timeout: 45000 })
  // the iPad
  const ipad = await browser.open(offered.url)
  await until(() => ipad.evaluate("document.body?.innerText.includes('Speaker View') || document.body?.innerText.includes('/ 02')"), 'presenter view renders')
  await until(() => ipad.evaluate("(() => { try { return !!document.querySelector('iframe').contentDocument.querySelector('deck-stage') } catch { return false } })()"), 'deck inside presenter')
  await until(() => ipad.evaluate("document.querySelector('iframe')?.contentDocument?.querySelector('.relay-custom-layout img')?.naturalWidth === 10"), 'custom layout and referenced image render')
  const token = await ipad.evaluate("localStorage.getItem('mdeck-pair:' + location.origin + location.pathname)")
  assert.ok(token && token.length > 20, 'the iPad paired')
  assert.ok(!(await ipad.evaluate('location.href')).includes('pair='), 'the one-time token left the address')
  // paired: ink API answers; unpaired: refused
  const inkAs = auth => ipad.evaluate(`fetch(location.pathname + '__mdeck/ink', { headers: ${auth ? `{ Authorization: 'Bearer ${token}' }` : '{}'} }).then(r => r.status)`)
  assert.equal(await inkAs(true), 200); assert.equal(await inkAs(false), 403, 'unpaired requests through the tunnel are refused')
  // the server lets the paired iPad steer
  assert.equal(await (await fetch(`${ROOM}/info`, { headers: { Authorization: `Bearer ${token}` } })).json().then(j => j.canReset), true)
  assert.equal(await (await fetch(`${ROOM}/info`)).json().then(j => j.canReset), false)
  const control = async (code, token) => (await fetch(`${ROOM}/rooms/${code}.stage/state`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ state: { at: 1, screen: 'test' } }) })).status
  assert.equal(await control('123456', token), 200)
  assert.equal(await control('654321', token), 403, 'pairing cannot steer a different session')
  // live reload crosses the tunnel: add a slide on the laptop
  writeFileSync(deck, source(3))
  await until(() => ipad.evaluate("(() => { try { return document.querySelector('iframe')?.contentDocument?.querySelector('deck-stage')?.length === 3 } catch { return false } })()"), 'iPad reloads after an edit', 25000)
  // The laptop's audience window follows the paired iPad through the control proxy.
  const projector = await browser.open(`${home}?view=audience`)
  await until(() => projector.evaluate("document.querySelector('deck-stage')?.length === 3"), 'projector loads')
  await ipad.evaluate("document.querySelector('iframe').contentDocument.querySelector('deck-stage').goTo(2)")
  await until(() => projector.evaluate("document.querySelector('deck-stage')?.index === 2"), 'projector follows iPad')
  // Navigation on the laptop must also reach the iPad, including its sidebar
  // and next-slide preview. Received positions must not echo back to the room.
  await projector.evaluate("document.querySelector('deck-stage').goTo(1)")
  await until(() => ipad.evaluate("document.querySelector('iframe')?.contentDocument?.querySelector('deck-stage')?.index === 1"), 'iPad follows projector')
  await until(() => ipad.evaluate("document.querySelector('iframe[title=\"Next slide preview\"]')?.contentDocument?.querySelector('deck-stage')?.index === 2"), 'iPad next-slide preview follows projector')
  await until(() => ipad.evaluate("document.querySelector('.presenter-aside')?.textContent.includes('02 / 03')"), 'iPad sidebar follows projector')
  await projector.evaluate("document.querySelector('deck-stage').next()")
  await until(() => ipad.evaluate("document.querySelector('iframe')?.contentDocument?.querySelector('deck-stage')?.state.step === 0"), 'iPad follows projector reveal')
  await ipad.evaluate("document.querySelector('iframe').contentDocument.querySelector('deck-stage').prev()")
  await until(() => projector.evaluate("document.querySelector('deck-stage')?.state.step === -1"), 'projector follows iPad undo reveal')
  await projector.evaluate("document.querySelector('deck-stage').next()")
  await until(() => ipad.evaluate("document.querySelector('iframe')?.contentDocument?.querySelector('deck-stage')?.state.step === 0"), 'projector can repeat its previous reveal')
  const position = await stageState()
  assert.equal(position.index, 1)
  await delay(500)
  assert.deepEqual(await stageState(), position, 'position remains stable without echoes')
  await ipad.evaluate("document.querySelector('iframe').contentDocument.querySelector('deck-stage').goTo(2)")
  await until(() => projector.evaluate("document.querySelector('deck-stage')?.index === 2"), 'iPad can move back to its previous position')
  // the launch page under the base path
  const launch = await browser.open(`${home}home.html`)
  await until(() => launch.evaluate("document.body?.innerText.toLowerCase().includes('present from an ipad')"), 'launch page renders', 8000)
  await until(() => launch.evaluate("document.body?.innerText.toLowerCase().includes('connected to your server')"), 'connection status shown')
  // Loading the iPad's pages asked for nothing that is kept private (the three above were asked for on purpose).
  // Two decks on the same relay keep independent tokens in one browser.
  const otherDeck = resolve(temp, 'other.md')
  writeFileSync(otherDeck, source(2).replace('123456', '654321'))
  const second = run('second', ['bin/mdeck.js', 'run', otherDeck, '--server', '--no-open', '--port', String(await freePort())], { MDECK_SERVER_KEY: KEY })
  await until(() => /Connected to/.test(second.out()), 'second tunnel')
  const otherHome = second.out().match(/Launch page: (http\S+)/)[1].replace(/home.html$/, '')
  const otherOffer = await (await fetch(`${otherHome}__mdeck/home/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'pair' }) })).json()
  const other = await browser.open(otherOffer.url)
  await until(() => other.evaluate("(() => { try { return !!localStorage.getItem('mdeck-pair:' + location.origin + location.pathname) } catch { return false } })()"), 'second pairing')
  const otherToken = await other.evaluate("localStorage.getItem('mdeck-pair:' + location.origin + location.pathname)")
  assert.notEqual(otherToken, token)
  assert.equal(await inkAs(true), 200, 'first tunnel still accepts its token')
  const ownProxy = await ipad.evaluate("fetch(location.pathname + '__mdeck/live/info', { headers: { Authorization: 'Bearer ' + localStorage.getItem('mdeck-pair:' + location.origin + location.pathname) } }).then(r => r.json()).then(j => j.canReset)")
  assert.equal(ownProxy, true)
  // A stale master key in this browser must never override pairing.
  await ipad.evaluate(`localStorage.setItem('mdeck-server-key:${ROOM}', '${KEY}')`)
  const browserAuthorization = await ipad.evaluate(`import('${ROOM}${base}@fs${root}/src/live/client.js').then(m => m.stageRoom().headers().Authorization)`)
  assert.equal(browserAuthorization, `Bearer ${token}`, 'the client ignores a stale master key on a paired page')
  await fetch(`${home}__mdeck/home/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unpair' }) })
  assert.equal(await inkAs(true), 403)
  await until(async () => await control('123456', token) === 403, 'revocation reaches relay')
  const revokedProxy = await ipad.evaluate("fetch(location.pathname + '__mdeck/live/info', { headers: { Authorization: 'Bearer ' + localStorage.getItem('mdeck-pair:' + location.origin + location.pathname) } }).then(r => r.json()).then(j => j.canReset)")
  assert.equal(revokedProxy, false, 'unpairing also removes room control')
  assert.equal(await control('654321', otherToken), 200, 'other pairing remains valid')
  const refused = dev.out().split('\n').filter(line => /not shared/.test(line) && !/home\.html|__mdeck\/home\/info|__mdeck\/deck|private|confidential/.test(line))
  assert.deepEqual(refused, [])
  console.log('Server check passed: bidirectional slide/reveal sync and presenter previews without echoes, pairing through the server, refused addresses, scoped tokens, revocation, two concurrent decks, custom layouts and assets, live reload.')
} catch (error) { console.error('Server check failed:', error.stack, devLog()); process.exitCode = 1 }
finally { await browser?.close?.(); for (const k of kids) k.kill(); rmSync(temp, { recursive: true, force: true }) }
