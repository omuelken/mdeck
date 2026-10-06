import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createServer as createHttpServer } from 'node:http'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { slidesPlugin } from '../src/build/slidesPlugin.js'

const withPicture = '# Slide\n\n![Picture](./picture.svg)\n'
const withoutPicture = '# Slide\n'

for (const [change, before, after, present] of [
  ['added to', withoutPicture, withPicture, true],
  ['removed from', withPicture, withoutPicture, false],
]) test(`the SVG module follows images ${change} the deck without restarting Vite`, async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'mdeck-svg-reload-'))
  const deck = resolve(dir, 'slides.md')
  writeFileSync(deck, before)
  writeFileSync(resolve(dir, 'picture.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><text fill="var(--accent)">RELOAD_SVG_CONTENT</text></svg>')
  const server = await createServer({
    configFile: false, root: dir, plugins: [slidesPlugin(deck)], appType: 'custom',
    cacheDir: resolve(dir, 'cache'), optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: { server: createHttpServer() } }, logLevel: 'silent',
  })
  const module = () => server.transformRequest('virtual:deck-svgs')
  const until = async predicate => {
    const deadline = Date.now() + 5000
    while (Date.now() < deadline) {
      if (predicate((await module()).code)) return
      await delay(25)
    }
    assert.fail('the cached SVG module did not reflect the edited deck')
  }
  try {
    assert.equal((await module()).code.includes('RELOAD_SVG_CONTENT'), !present)
    writeFileSync(deck, after)
    await until(code => code.includes('RELOAD_SVG_CONTENT') === present)
  } finally {
    await server.close()
    rmSync(dir, { recursive: true, force: true })
  }
})
