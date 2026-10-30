import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readdirSync, writeFileSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { request as httpRequest } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startLiveServer } from '../src/live/server.js'
import { parseArgs } from '../src/cli/args.js'

const dir = mkdtempSync(join(tmpdir(), 'mdeck-decks-'))
const live = await startLiveServer({ port: 0, key: 'secret', decks: dir })
const off = await startLiveServer({ port: 0, key: 'secret' })
after(async () => { await live.close(); await off.close(); rmSync(dir, { recursive: true, force: true }) })
const auth = { Authorization: 'Bearer secret' }
const page = '<!doctype html><html><body>hello</body></html>'
const put = (name, body = page, headers = auth) => fetch(`${live.url}/decks/${name}`, { method: 'PUT', headers, body })

test('a deck published with the key opens at /d/<name> without one', async () => {
  const response = await put('lecture-1')
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { name: 'lecture-1', path: '/d/lecture-1', bytes: page.length, replaced: false })
  const shown = await fetch(`${live.url}/d/lecture-1`)
  assert.equal(shown.status, 200)
  assert.match(shown.headers.get('content-type'), /^text\/html/)
  assert.equal(shown.headers.get('referrer-policy'), 'no-referrer')
  assert.equal(await shown.text(), page)
  const taken = await put('lecture-1', page.replace('hello', 'again'))
  assert.equal(taken.status, 409, 'an existing deck is not overwritten by default')
  assert.deepEqual(Object.keys(await taken.json()).sort(), ['bytes', 'error', 'exists', 'updated'])
  assert.match(await (await fetch(`${live.url}/d/lecture-1`)).text(), /hello/)
  const replaced = await put('lecture-1', page.replace('hello', 'again'), { ...auth, 'X-Mdeck-Replace': '1' })
  assert.equal(replaced.status, 200)
  assert.equal((await replaced.json()).replaced, true)
  assert.match(await (await fetch(`${live.url}/d/lecture-1`)).text(), /again/)
  assert.deepEqual(readdirSync(dir), ['lecture-1.html'], 'no temporary files are left')
})

test('publishing needs the key; a wrong key is refused and nothing is stored', async () => {
  assert.equal((await put('nokey', page, {})).status, 401)
  assert.equal((await put('wrong', page, { Authorization: 'Bearer nope' })).status, 401)
  assert.equal((await fetch(`${live.url}/d/nokey`)).status, 404)
})

test('names and content are checked', async () => {
  assert.equal((await put('Bad_Name')).status, 400)
  assert.equal((await put('..%2Fx')).status, 400)
  assert.equal((await put('notpage', 'just text')).status, 400)
  assert.equal((await fetch(`${live.url}/d/..%2Fsecret`)).status, 404)
})

test('too large a deck is refused', async () => {
  const small = await startLiveServer({ port: 0, key: 'secret', decks: dir })
  after(() => small.close())
  // The route's limit is its own option; the default is far above this body.
  const { deckRoutes } = await import('../src/live/decks.js')
  const routes = deckRoutes({ dir, key: 'secret', maxBytes: 10 })
  const { createServer } = await import('node:http')
  const server = createServer((request, response) => { if (!routes(request, response)) response.end() }).listen(0)
  after(() => server.close())
  const response = await fetch(`http://127.0.0.1:${server.address().port}/decks/big`, { method: 'PUT', headers: auth, body: page })
  assert.equal(response.status, 413)
  assert.equal((await fetch(`${live.url}/d/big`)).status, 404)
})

test('a published deck can be listed and removed with the key', async () => {
  assert.equal((await fetch(`${live.url}/decks`)).status, 401)
  const listed = await (await fetch(`${live.url}/decks`, { headers: auth })).json()
  assert.deepEqual(listed.decks.map(deck => deck.name), ['lecture-1'])
  assert.equal((await fetch(`${live.url}/decks/lecture-1`, { method: 'DELETE', headers: auth })).status, 200)
  assert.equal((await fetch(`${live.url}/d/lecture-1`)).status, 404)
  assert.equal((await fetch(`${live.url}/decks/lecture-1`, { method: 'DELETE', headers: auth })).status, 404)
})

test('without --decks or a key nothing is accepted', async () => {
  assert.equal((await fetch(`${off.url}/decks/x`, { method: 'PUT', headers: auth, body: page })).status, 404)
  const nokey = await startLiveServer({ port: 0, decks: dir })
  after(() => nokey.close())
  assert.equal((await fetch(`${nokey.url}/decks/x`, { method: 'PUT', body: page })).status, 404)
})

test('mdeck publish takes its options', () => {
  assert.equal(parseArgs('publish', ['talk.md', '--name', 'talk', '--server', 'https://a.example.org']).options['--name'], 'talk')
  assert.throws(() => parseArgs('publish', ['--server', 'https://a.example.org/path']), /origin/)
  assert.throws(() => parseArgs('publish', ['--replace', '--remove']), /Choose/)
  assert.equal(parseArgs('server', ['--decks', 'decks']).options['--decks'], 'decks')
})

test('a streamed upload over the limit is answered with 413, not a reset', async () => {
  const { deckRoutes } = await import('../src/live/decks.js')
  const { createServer } = await import('node:http')
  const routes = deckRoutes({ dir, key: 'secret', maxBytes: 10 })
  const server = createServer((request, response) => { if (!routes(request, response)) response.end() }).listen(0)
  after(() => server.close())
  const status = await new Promise((done, fail) => {
    const upload = httpRequest({ port: server.address().port, path: '/decks/chunked', method: 'PUT', headers: auth }, response => { done(response.statusCode); response.resume() })
    upload.on('error', fail)
    upload.write('<html>'); upload.write('x'.repeat(100))
  })
  assert.equal(status, 413)
})

test('two uploads of one name without --replace: one wins, the other gets 409', async () => {
  const results = await Promise.all([put('race', page.replace('hello', 'one')), put('race', page.replace('hello', 'two'))])
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409])
})

test('a decks folder keeps no stale temporary files after a start', async () => {
  writeFileSync(join(dir, 'old.1234.tmp'), 'x')
  const again = await startLiveServer({ port: 0, key: 'secret', decks: dir })
  after(() => again.close())
  assert.ok(!readdirSync(dir).some(file => file.endsWith('.tmp')))
})

const cli = join(import.meta.dirname, '..', 'bin', 'mdeck.js')
const run = (args, env = {}, cwd = dir) => new Promise(done => execFile(process.execPath, [cli, ...args], { cwd, env: { ...process.env, MDECK_SERVER_KEY: 'secret', ...env }, encoding: 'utf8' }, (error, stdout, stderr) => done({ code: error?.code ?? 0, out: stdout + stderr })))

test('mdeck publish: a taken name is refused before the build, --replace updates, --remove needs no slides file', async () => {
  const work = mkdtempSync(join(tmpdir(), 'mdeck-publish-cli-'))
  after(() => rmSync(work, { recursive: true, force: true }))
  writeFileSync(join(work, 'Übung 1.md'), '# Hello\n')
  const before = readdirSync(tmpdir()).filter(file => file.startsWith('mdeck-publish-')).length
  const first = await run(['publish', join(work, 'Übung 1.md'), '--server', live.url], {}, work)
  assert.equal(first.code, 0, first.out)
  assert.match(first.out, /\/d\/ubung-1/)
  assert.match(await (await fetch(`${live.url}/d/ubung-1`)).text(), /<html/i)
  const again = await run(['publish', join(work, 'Übung 1.md'), '--server', live.url], {}, work)
  assert.equal(again.code, 1)
  assert.match(again.out, /already exists/)
  assert.doesNotMatch(again.out, /Built|Made/, 'no build ran')
  const replaced = await run(['publish', join(work, 'Übung 1.md'), '--server', live.url, '--replace'], {}, work)
  assert.match(replaced.out, /Replaced/)
  assert.equal(readdirSync(tmpdir()).filter(file => file.startsWith('mdeck-publish-')).length, before, 'no temporary folders are left')
  const removed = await run(['publish', '--name', 'ubung-1', '--remove', '--server', live.url], {}, work)
  assert.equal(removed.code, 0, removed.out)
  assert.equal((await fetch(`${live.url}/d/ubung-1`)).status, 404)
  const wrong = await run(['publish', join(work, 'Übung 1.md'), '--server', live.url], { MDECK_SERVER_KEY: 'nope' }, work)
  assert.equal(wrong.code, 1)
  assert.match(wrong.out, /key is wrong/)
})
