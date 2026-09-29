// Real-browser regression check, driven over the DevTools protocol by the same
// helper that renders PDFs. Uses a local Chrome; set MDECK_CHROME to override.
//   npm run test:browser
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { launchChrome } from '../src/build/chrome.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const temp = mkdtempSync(resolve(tmpdir(), 'mdeck-browser-check-'))
let browser
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
  console.log('Browser checks passed: custom template rendering, reveal/undo/reset synchronization, session isolation.')
} finally {
  await browser?.close()
  rmSync(temp, { recursive: true, force: true })
}
