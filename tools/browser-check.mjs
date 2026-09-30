// Real-browser regression check, driven over the DevTools protocol by the same
// helper that renders PDFs. Uses a local Chrome; set MDECK_CHROME to override.
//   npm run test:browser
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { createServer } from 'vite'
import { launchChrome } from '../src/build/chrome.js'
import { baseConfig } from '../src/build/config.js'
import { homePlugin } from '../src/build/homePlugin.js'
import { livePlugin } from '../src/live/server.js'
import { inkPlugin } from '../src/build/inkPlugin.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const temp = mkdtempSync(resolve(tmpdir(), 'mdeck-browser-check-'))
let browser, dev, pollDev, inkDev
try {
  execFileSync(process.execPath, ['bin/mdeck.js', 'build', 'examples/custom-templates/slides.md', '-o', resolve(temp, 'deck.html')], { cwd: root, stdio: 'pipe' })
  browser = await launchChrome({ dir: temp, timeout: 45000 })
  const open = path => browser.open(path)
  async function until(page, expression) {
    if (!await page.waitFor(expression, { attempts: 150, interval: 50 })) throw new Error(`Condition did not become true: ${expression}`)
  }

  // Saved ink from <deck>.ink.json is bundled and drawn in the deck and in Read mode.
  const inkDeck = resolve(temp, 'ink.md')
  writeFileSync(inkDeck, '---\ndesign: neue\n---\n\n---\nid: marked\n---\n# Marked up\n')
  writeFileSync(resolve(temp, 'ink.ink.json'), JSON.stringify({ version: 1, width: 1920, height: 1080, slides: { marked: [{ id: 'check:1', tool: 'pen', color: '#e11d48', size: 8, points: [[200, 300, 0.4], [600, 320, 0.8], [900, 280, 0.6]] }] } }))
  execFileSync(process.execPath, ['bin/mdeck.js', 'build', inkDeck, '-o', resolve(temp, 'ink.html')], { cwd: root, stdio: 'pipe' })
  const inked = await open('ink.html?view=deck')
  await until(inked, "document.querySelectorAll('.slide-ink path').length === 1")
  // Drawing: D starts ink mode, a pen stroke becomes saved ink on the same
  // slide (tap zones stay off), and undo takes it back.
  await inked.evaluate("document.querySelector('deck-stage').inking = true")
  await until(inked, "!!document.querySelector('.ink-toolbar')")
  const rect = await inked.evaluate("(() => { const r = document.querySelector('deck-stage').getBoundingClientRect(); return [r.left, r.top, r.width, r.height] })()")
  const at = f => [rect[0] + rect[2] * f[0], rect[1] + rect[3] * f[1]]
  const pen = { button: 'left', pointerType: 'pen', force: 0.6 }
  await inked.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: at([0.2, 0.6])[0], y: at([0.2, 0.6])[1], clickCount: 1, buttons: 1, ...pen })
  for (let i = 1; i <= 10; i++) { const [x, y] = at([0.2 + 0.07 * i, 0.6]); await inked.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 1, ...pen }) }
  await inked.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at([0.9, 0.6])[0], y: at([0.9, 0.6])[1], clickCount: 1, buttons: 0, ...pen })
  await until(inked, "document.querySelectorAll('.slide-ink path').length === 2")
  assert.equal(await inked.evaluate("document.querySelector('deck-stage').index"), 0, 'drawing does not change slides')
  await inked.evaluate("document.querySelector('.ink-btn[title=Undo]').click()")
  await until(inked, "document.querySelectorAll('.slide-ink path').length === 1")
  const inkRead = await open('ink.html?view=share')
  await until(inkRead, "[...document.querySelectorAll('.share-btn')].some(b => b.textContent.includes('Read'))")
  await inkRead.evaluate("[...document.querySelectorAll('.share-btn')].find(b => b.textContent.includes('Read')).click()")
  await until(inkRead, "document.querySelectorAll('.share-read .slide-ink path').length === 1")

  const presenter = await open('deck.html?view=presenter')
  const stage = "document.querySelector('iframe')?.contentWindow?.document.querySelector('deck-stage')"
  await until(presenter, `${stage}?.length === 2`)
  // Let Preact install the presenter's event listeners.
  await delay(200)
  const session = await presenter.evaluate("new URL(location.href).searchParams.get('session')")
  assert.ok(session)
  const audience = await open('deck.html?view=audience&session=' + session)
  const other = await open('deck.html?view=audience&session=another-session')
  const audienceStage = "document.querySelector('deck-stage')"
  await until(audience, `${audienceStage}?.length === 2`)
  await until(other, `${audienceStage}?.length === 2`)
  assert.equal(await audience.evaluate("document.querySelector('.slide--comparison [data-region=left]')?.textContent.includes('Directory bundle')"), true)
  await presenter.evaluate(`${stage}.goTo(1); ${stage}.next()`)
  await until(audience, `${audienceStage}.state.index === 1 && ${audienceStage}.state.step === 0`)
  assert.equal(await audience.evaluate("document.querySelectorAll('[data-step-visible]').length"), 1)
  assert.equal(await other.evaluate(`${audienceStage}.state.index`), 0)
  await presenter.evaluate(`${stage}.prev()`)
  await until(audience, `${audienceStage}.state.step === -1`)
  await presenter.evaluate(`${stage}.reset()`)
  await until(audience, `${audienceStage}.state.index === 0`)

  // Saving in dev: the first stroke gives the slide an id from its heading and
  // writes <deck>.ink.json, without reloading the open windows.
  const saveDeck = resolve(temp, 'save.md')
  writeFileSync(saveDeck, '---\ndesign: neue\n---\n\n---\n# The important part\n\n---\n# Second\n')
  const saveConfig = baseConfig(saveDeck)
  inkDev = await createServer({ ...saveConfig, plugins: [...saveConfig.plugins, inkPlugin(saveDeck)], server: { ...saveConfig.server, port: 0, host: '127.0.0.1' }, logLevel: 'silent' })
  await inkDev.listen()
  const drawing = await open(new URL('?view=deck', inkDev.resolvedUrls.local[0]).href)
  await until(drawing, "document.querySelector('deck-stage')?.length === 2")
  await delay(500)
  await drawing.evaluate('window.__sameDocument = true; document.querySelector("deck-stage").inking = true')
  const box = await drawing.evaluate("(() => { const r = document.querySelector('deck-stage').getBoundingClientRect(); return [r.left, r.top, r.width, r.height] })()")
  const on = ([fx, fy]) => ({ x: box[0] + box[2] * fx, y: box[1] + box[3] * fy })
  await drawing.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...on([0.2, 0.5]), clickCount: 1, buttons: 1, ...pen })
  for (let i = 1; i <= 10; i++) await drawing.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...on([0.2 + 0.05 * i, 0.5]), buttons: 1, ...pen })
  await drawing.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...on([0.7, 0.5]), clickCount: 1, buttons: 0, ...pen })
  await until(drawing, "document.querySelector('[data-deck-active]')?.dataset.slideId === 'the-important-part'")
  await delay(800)
  assert.match(readFileSync(saveDeck, 'utf8'), /id: the-important-part/)
  assert.ok(existsSync(resolve(temp, 'save.ink.json')), 'the ink file is written')
  assert.equal(await drawing.evaluate('window.__sameDocument === true'), true, 'saving does not reload the page')
  await drawing.evaluate('location.reload()')
  await until(drawing, "document.querySelectorAll('[data-deck-active] .slide-ink path').length === 1")

  // The launch page `mdeck dev` opens renders the deck's details from its API.
  const slides = resolve(root, 'examples/custom-templates/slides.md')
  const config = baseConfig(slides)
  dev = await createServer({ ...config, plugins: [...config.plugins, homePlugin(slides, { services: {} })], server: { ...config.server, port: 0, host: '127.0.0.1' }, logLevel: 'silent' })
  await dev.listen()
  const home = await open(new URL('home.html', dev.resolvedUrls.local[0]).href)
  await until(home, "document.querySelectorAll('.home-tile').length === 6 && !!document.querySelector('.home-header h1')?.textContent")
  assert.equal(await home.evaluate("document.querySelectorAll('.home-output').length"), 3)
  assert.equal(await home.evaluate("!!document.querySelector('.home-preview iframe') && !document.querySelector('.home-live')"), true, 'preview, and no live section without live.server')

  // Relay mode: the projector announces the poll on screen, the phone opens the
  // room server's own answer page at /<code>, and its vote reaches the slide.
  const pollDeck = resolve(temp, 'poll.md')
  writeFileSync(pollDeck, '---\ndesign: neue\nlang: de\nmeta:\n  title: Poll check\nlive:\n  code: 424242\n---\n\n---\n# Lunch?\n\n<poll room="lunch" options="Mensa|Thai" />\n')
  const pollConfig = baseConfig(pollDeck)
  pollDev = await createServer({ ...pollConfig, plugins: [...pollConfig.plugins, livePlugin()], server: { ...pollConfig.server, port: 0, host: '127.0.0.1' }, logLevel: 'silent' })
  await pollDev.listen()
  const pollBase = pollDev.resolvedUrls.local[0]
  const projector = await open(new URL('?view=deck', pollBase).href)
  await until(projector, "!!document.querySelector('.poll-dot.is-live')")
  assert.equal(await projector.evaluate("document.querySelector('.poll-join--local a')?.href"), new URL('__mdeck/live/424242', pollBase).href, 'on this computer only, a link to try the answer page')
  const phone = await open(new URL('__mdeck/live/424242', pollBase).href)
  await until(phone, "document.querySelectorAll('.answer-options button').length === 2 && document.querySelector('.answer h1')?.textContent === 'Lunch?'")
  assert.equal(await phone.evaluate("document.documentElement.lang + ' ' + getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()"), 'de #0d9488', "the deck's language and look")
  await phone.evaluate("document.querySelectorAll('.answer-options button')[1].click()")
  await until(projector, "[...document.querySelectorAll('.poll-count')].map(e => e.textContent).join() === '0,1'")
  await until(phone, "document.querySelector('.answer-status').textContent.includes('Thai')")
  console.log('Browser checks passed: custom template rendering, reveal/undo/reset synchronization, session isolation, launch page, poll relay, saved ink, drawing, saving ink in dev.')
} finally {
  await browser?.close()
  await dev?.close()
  await pollDev?.close()
  await inkDev?.close()
  rmSync(temp, { recursive: true, force: true })
}
