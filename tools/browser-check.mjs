// Real-browser regression check, driven over the DevTools protocol by the same
// helper that renders PDFs. Uses a local Chrome; set MDECK_CHROME to override.
//   npm run test:browser
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { createServer } from 'vite'
import { launchChrome } from '../src/build/chrome.js'
import { baseConfig } from '../src/build/config.js'
import { homePlugin } from '../src/build/homePlugin.js'
import { livePlugin } from '../src/live/server.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const temp = mkdtempSync(resolve(tmpdir(), 'mdeck-browser-check-'))
let browser, dev, pollDev
try {
  execFileSync(process.execPath, ['bin/mdeck.js', 'build', 'examples/custom-templates/slides.md', '-o', resolve(temp, 'deck.html')], { cwd: root, stdio: 'pipe' })
  browser = await launchChrome({ dir: temp, timeout: 45000 })
  const open = path => browser.open(path)
  async function until(page, expression) {
    if (!await page.waitFor(expression, { attempts: 150, interval: 50 })) throw new Error(`Condition did not become true: ${expression}`)
  }

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

  // The launch page `mdeck dev` opens renders the deck's details from its API.
  const slides = resolve(root, 'examples/custom-templates/slides.md')
  const config = baseConfig(slides)
  dev = await createServer({ ...config, plugins: [...config.plugins, homePlugin(slides, { services: {} })], server: { ...config.server, port: 0, host: '127.0.0.1' }, logLevel: 'silent' })
  await dev.listen()
  const home = await open(new URL('home.html', dev.resolvedUrls.local[0]).href)
  await until(home, "document.querySelectorAll('.home-tile').length === 5 && !!document.querySelector('.home-header h1')?.textContent")
  assert.equal(await home.evaluate("document.querySelectorAll('.home-output').length"), 3)
  assert.equal(await home.evaluate("[...document.querySelectorAll('.home-block strong')].some(el => el.textContent === 'Side-by-side comparison')"), true)

  // A poll: a phone's vote reaches the slide through the dev server's rooms.
  const pollDeck = resolve(temp, 'poll.md')
  writeFileSync(pollDeck, '---\ndesign: neue\nmeta:\n  title: Poll check\nlive:\n  audience: https://example.org/talk/\n---\n\n---\n# Lunch?\n\n<poll room="lunch" options="Mensa|Thai" />\n')
  const pollConfig = baseConfig(pollDeck)
  pollDev = await createServer({ ...pollConfig, plugins: [...pollConfig.plugins, livePlugin()], server: { ...pollConfig.server, port: 0, host: '127.0.0.1' }, logLevel: 'silent' })
  await pollDev.listen()
  const pollBase = pollDev.resolvedUrls.local[0]
  const projector = await open(new URL('?view=deck', pollBase).href)
  await until(projector, "!!document.querySelector('.poll-dot.is-live')")
  const phone = await open(new URL('?view=respond&room=lunch', pollBase).href)
  await until(phone, "document.querySelectorAll('.poll-options button').length === 2 && document.querySelector('.poll-answer h1')?.textContent === 'Lunch?'")
  await phone.evaluate("document.querySelectorAll('.poll-options button')[1].click()")
  await until(projector, "[...document.querySelectorAll('.poll-count')].map(e => e.textContent).join() === '0,1'")
  await until(phone, "document.querySelector('.poll-status').textContent.includes('Thai')")
  // The deck's one link follows the presenter's slide: here the poll's.
  const follower = await open(new URL('?view=respond', pollBase).href)
  await until(follower, "document.querySelectorAll('.poll-options button').length === 2")
  assert.equal(await projector.evaluate("document.querySelector('a.poll-join')?.href"), 'https://example.org/talk/?view=respond')
  console.log('Browser checks passed: custom template rendering, reveal/undo/reset synchronization, session isolation, launch page, poll, following the presenter.')
} finally {
  await browser?.close()
  await dev?.close()
  await pollDev?.close()
  rmSync(temp, { recursive: true, force: true })
}
