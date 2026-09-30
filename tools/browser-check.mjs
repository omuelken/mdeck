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
let browser, dev, pollDev, inkDev, tablet2
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

  // Drawing in the presenter view: Draw turns on the main frame's ink mode,
  // and the audience window shows the stroke while it is drawn and after.
  const inkPresenter = await open('ink.html?view=presenter')
  const inkFrame = "document.querySelector('iframe')?.contentWindow?.document"
  await until(inkPresenter, `${inkFrame}?.querySelectorAll('.slide-ink path').length === 1`)
  await delay(200)
  const inkSession = await inkPresenter.evaluate("new URL(location.href).searchParams.get('session')")
  const inkAudience = await open('ink.html?view=audience&session=' + inkSession)
  await until(inkAudience, "document.querySelectorAll('.slide-ink path').length === 1")
  await inkPresenter.evaluate("document.querySelector('.presenter-draw').click()")
  await until(inkPresenter, "document.querySelector('.presenter-draw').getAttribute('aria-pressed') === 'true'")
  const frameBox = await inkPresenter.evaluate(`(() => { const f = document.querySelector('iframe').getBoundingClientRect(), r = ${inkFrame}.querySelector('deck-stage').getBoundingClientRect(); return [f.left + r.left, f.top + r.top, r.width, r.height] })()`)
  const inFrame = ([fx, fy]) => ({ x: frameBox[0] + frameBox[2] * fx, y: frameBox[1] + frameBox[3] * fy })
  await inkPresenter.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...inFrame([0.2, 0.3]), clickCount: 1, buttons: 1, ...pen })
  for (let i = 1; i <= 6; i++) await inkPresenter.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...inFrame([0.2 + 0.05 * i, 0.3]), buttons: 1, ...pen })
  await until(inkAudience, "document.querySelector('deck-stage').shadowRoot.querySelectorAll('.ink-live path').length === 1")
  await inkPresenter.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...inFrame([0.5, 0.3]), clickCount: 1, buttons: 0, ...pen })
  await until(inkAudience, "document.querySelectorAll('.slide-ink path').length === 2 && document.querySelector('deck-stage').shadowRoot.querySelectorAll('.ink-live path').length === 0")

  // On a touch screen (an iPad): a finger draws until a pen was used, and
  // the presenter view opens with the slide filling the screen.
  const tablet = await open('ink.html?view=deck')
  await tablet.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
  await until(tablet, "document.querySelectorAll('.slide-ink path').length === 2")
  await tablet.evaluate("document.querySelector('deck-stage').inking = true")
  const finger = (type, x, y) => tablet.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, radiusX: 4, radiusY: 4, force: 0.5, id: 1 }] })
  await finger('touchStart', 300, 300)
  for (let i = 1; i < 8; i++) await finger('touchMove', 300 + i * 30, 300 + i * 8)
  await finger('touchEnd')
  await until(tablet, "document.querySelectorAll('.slide-ink path').length === 3")
  assert.equal(await tablet.evaluate("document.querySelector('deck-stage').index"), 0, 'a finger stroke does not change slides')
  const tabletPresenter = await open('about:blank')
  await tabletPresenter.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
  await tabletPresenter.send('Page.navigate', { url: new URL('ink.html?view=presenter', await tablet.evaluate('location.href')).href })
  await until(tabletPresenter, "!!document.querySelector('.presenter--slide .presenter-pill') && getComputedStyle(document.querySelector('.presenter-aside')).display === 'none'")
  await tabletPresenter.evaluate("document.querySelector('.presenter-notes').click()")
  await until(tabletPresenter, "getComputedStyle(document.querySelector('.presenter-aside')).display === 'flex'")

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
  inkDev = await createServer({ ...saveConfig, plugins: [...saveConfig.plugins, livePlugin(), inkPlugin(saveDeck)], server: { ...saveConfig.server, port: 0, host: '127.0.0.1' }, logLevel: 'silent' })
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

  // Two devices through the stage room: a presenter view in another browser
  // (the iPad) moves and draws; this browser's audience window follows.
  tablet2 = await launchChrome({ dir: temp, timeout: 45000 })
  const inkBase = inkDev.resolvedUrls.local[0]
  const projector2 = await open(new URL('?view=audience&session=room-check', inkBase).href)
  await until(projector2, "document.querySelector('deck-stage')?.length === 2")
  const ipad = await tablet2.open(new URL('?view=presenter', inkBase).href)
  const ipadFrame = "document.querySelector('iframe')?.contentWindow?.document"
  await until(ipad, `${ipadFrame}?.querySelector('deck-stage')?.length === 2`)
  await delay(500)
  await ipad.evaluate(`${ipadFrame}.querySelector('deck-stage').next()`)
  await until(projector2, "document.querySelector('deck-stage').index === 1")
  await ipad.evaluate("document.querySelector('.presenter-draw').click()")
  await until(ipad, "document.querySelector('.presenter-draw').getAttribute('aria-pressed') === 'true'")
  const ipadBox = await ipad.evaluate(`(() => { const f = document.querySelector('iframe').getBoundingClientRect(), r = ${ipadFrame}.querySelector('deck-stage').getBoundingClientRect(); return [f.left + r.left, f.top + r.top, r.width, r.height] })()`)
  const onIpad = ([fx, fy]) => ({ x: ipadBox[0] + ipadBox[2] * fx, y: ipadBox[1] + ipadBox[3] * fy })
  await ipad.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...onIpad([0.2, 0.6]), clickCount: 1, buttons: 1, ...pen })
  for (let i = 1; i <= 8; i++) { await ipad.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...onIpad([0.2 + 0.05 * i, 0.6]), buttons: 1, ...pen }); await delay(30) }
  await until(projector2, "document.querySelector('deck-stage').shadowRoot.querySelectorAll('.ink-live path').length === 1")
  await ipad.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...onIpad([0.6, 0.6]), clickCount: 1, buttons: 0, ...pen })
  await until(projector2, "document.querySelectorAll('[data-deck-active] .slide-ink path').length === 1 && document.querySelector('deck-stage').shadowRoot.querySelectorAll('.ink-live path').length === 0")

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
  writeFileSync(pollDeck, '---\ndesign: neue\nlang: de\nmeta:\n  title: Poll check\nlive:\n  code: 424242\n---\n\n---\n# Lunch?\n\n<poll room="lunch" options="Mensa|Thai" />\n\n---\n# Pace?\n\n<scale room="pace" min="1" max="5" qr="false" />\n\n---\n# Anything else?\n\n<question room="ask" qr="false" />\n\n---\n# One word?\n\n<wordcloud room="mood" qr="false" />\n\n---\n# Join\n\n<qrcode join />\n')
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
  // The other kinds: a scale and an open question, answered on the same page.
  await projector.evaluate("document.querySelector('deck-stage').goTo(1)")
  await until(phone, "document.querySelectorAll('.answer-scale button').length === 5")
  await phone.evaluate("document.querySelectorAll('.answer-scale button')[3].click()")
  await until(projector, "[...document.querySelectorAll('[data-deck-active] .scale-count')].map(e => e.textContent).join() === '0,0,0,1,0' && document.querySelector('[data-deck-active] .scale-average').textContent.includes('4.0')")
  await projector.evaluate("document.querySelector('deck-stage').goTo(2)")
  await until(phone, "!!document.querySelector('.answer-text textarea')")
  await phone.evaluate("document.querySelector('.answer-text textarea').value = 'Does it work offline?'; document.querySelector('.answer-text button').click()")
  await until(projector, "document.querySelector('[data-deck-active] .question-cards li')?.textContent === 'Does it work offline?' && !document.querySelector('[data-deck-active] .poll-join')")
  await projector.evaluate("document.querySelector('deck-stage').goTo(3)")
  await until(phone, "!!document.querySelector('.answer-text textarea')")
  await phone.evaluate("document.querySelector('.answer-text textarea').value = 'fun'; document.querySelector('.answer-text button').click()")
  await until(projector, "[...document.querySelectorAll('[data-deck-active] .word-cloud text')].map(e => e.textContent).join() === 'fun'")
  await projector.evaluate("document.querySelector('deck-stage').goTo(4)")
  await until(projector, "!!document.querySelector('[data-deck-active] .poll-join-slide .poll-join')")
  console.log('Browser checks passed: custom template rendering, reveal/undo/reset synchronization, session isolation, launch page, poll relay, scale, open questions, word cloud and join code, saved ink, drawing, drawing in the presenter view, touch, saving ink in dev, a second device through the stage room.')
} finally {
  await browser?.close()
  await tablet2?.close()
  await dev?.close()
  await pollDev?.close()
  await inkDev?.close()
  rmSync(temp, { recursive: true, force: true })
}
