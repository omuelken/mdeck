import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createServer as createHttpServer } from 'node:http'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { languageOfFile, languageFiles, textDirection } from '../src/core/languages.js'
import { slidesPlugin } from '../src/build/slidesPlugin.js'

test('a file name names its language with a language code', () => {
  assert.deepEqual(languageOfFile('talk.de.md'), { name: 'talk', lang: 'de' })
  assert.deepEqual(languageOfFile('my.talk.en.md'), { name: 'my.talk', lang: 'en' })
  assert.deepEqual(languageOfFile('talk.de-CH.md'), { name: 'talk', lang: 'de-CH' })
  for (const name of ['talk.md', 'talk.v1.md', 'talk.ok.md', 'talk.xx.md', 'talk.de.txt']) assert.equal(languageOfFile(name), null, name)
})

test('the same deck in other languages: only with a second one', () => {
  const folder = ['talk.en.md', 'talk.de.md', 'talk.md', 'other.fr.md', 'talk.en.drawings.json']
  assert.deepEqual(languageFiles('talk.en.md', folder), [{ lang: 'de', file: 'talk.de.md' }, { lang: 'en', file: 'talk.en.md' }])
  assert.deepEqual(languageFiles('other.fr.md', folder), [])
  assert.deepEqual(languageFiles('talk.md', folder), [])
})

async function slidesModule(deck, options) {
  const server = await createServer({
    configFile: false, root: resolve(deck, '..'), plugins: [slidesPlugin(deck, options)], appType: 'custom',
    cacheDir: resolve(deck, '../cache'), optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: { server: createHttpServer() } }, logLevel: 'silent',
  })
  try { return await server.ssrLoadModule('virtual:slides') } finally { await server.close() }
}

test('mdeck run brings the other languages; a build has one', async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'mdeck-languages-'))
  try {
    const deck = resolve(dir, 'talk.en.md')
    writeFileSync(deck, '# Enzyme kinetics\n')
    writeFileSync(resolve(dir, 'talk.de.md'), '# Enzymkinetik\n')
    const run = await slidesModule(deck, { languages: true })
    assert.equal(run.default, '# Enzyme kinetics\n')
    assert.equal(run.language, 'en')
    assert.deepEqual(run.languages, { en: '# Enzyme kinetics\n', de: '# Enzymkinetik\n' })
    const built = await slidesModule(deck, {})
    assert.equal(built.language, 'en')
    assert.deepEqual(built.languages, {})
    rmSync(resolve(dir, 'talk.de.md'))
    assert.deepEqual((await slidesModule(deck, { languages: true })).languages, {}, 'one language shows no switch')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('Farsi, Arabic and Hebrew run from right to left', () => {
  for (const lang of ['fa', 'ar', 'he', 'ur-PK']) assert.equal(textDirection(lang), 'rtl', lang)
  for (const lang of ['en', 'de-CH', 'hi', '', undefined]) assert.equal(textDirection(lang), 'ltr', String(lang))
})
