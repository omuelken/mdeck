import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, existsSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createPositionFile, positionFileFor } from '../src/build/positionFile.js'
import { livePlugin } from '../src/live/server.js'
import { createServer } from 'node:http'

const deckIn = () => resolve(mkdtempSync(resolve(tmpdir(), 'mdeck-position-')), 'talk.md')

test('the slide the talk was on is kept beside the deck and found again by its id', () => {
  const deck = deckIn()
  let slides = ['intro', 'forces', 'energy']
  const file = createPositionFile(deck, { slides: () => slides, debounceMs: 0 })
  assert.equal(positionFileFor(deck), deck.replace(/\.md$/, '.position.json'))
  assert.equal(file.resume(), null, 'nothing kept yet: the first slide')
  file.save('energy')
  file.flush()
  assert.deepEqual(JSON.parse(readFileSync(file.path, 'utf8')), { slide: 'energy' })
  const again = createPositionFile(deck, { slides: () => slides })
  assert.deepEqual(again.resume(), { slideId: 'energy', index: 2 })
  slides = ['intro', 'new', 'forces', 'energy']
  assert.deepEqual(again.resume(), { slideId: 'energy', index: 3 }, 'a slide added before it')
  slides = ['intro', 'forces']
  assert.equal(again.resume(), null, 'a slide the deck no longer has opens the first one')
})

test('dropping the slide kept removes the file and tells the stage room', () => {
  const deck = deckIn()
  writeFileSync(positionFileFor(deck), '{"slide":"b"}\n')
  const file = createPositionFile(deck, { slides: () => ['a', 'b'] })
  let told = 0
  file.onDrop(() => told++)
  file.drop()
  assert.equal(existsSync(file.path), false)
  assert.equal(file.resume(), null)
  assert.equal(told, 1)
})

test('the stage room starts on the slide kept, keeps it from windows that open and saves slide changes', async t => {
  const deck = deckIn()
  writeFileSync(positionFileFor(deck), '{"slide":"b"}\n')
  const position = createPositionFile(deck, { slides: () => ['a', 'b', 'c'], debounceMs: 0 })
  let live
  livePlugin({ position, session: () => 'deck' }).configureServer({ middlewares: { use: (_, use) => { live = use } }, httpServer: null })
  const server = createServer((request, response) => live(request, response, () => { response.writeHead(404); response.end() }))
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  t.after(() => server.close())
  const room = `http://localhost:${server.address().port}/rooms/deck.stage`
  const state = async () => { const response = await fetch(`${room}/events`); const reader = response.body.getReader(); let text = ''; while (!text.includes('\n\n')) text += new TextDecoder().decode((await reader.read()).value); reader.cancel(); return JSON.parse(text.match(/^data: (.*)$/m)[1]).state }
  const post = body => fetch(`${room}/state`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: body }) })

  assert.equal((await state()).slideId, 'b', 'windows that open get the slide kept')
  assert.equal((await state()).step, -1, 'at its start')
  await post({ index: 0, step: -1, slideId: 'a', at: 0, screen: 'opened' })
  assert.equal((await state()).slideId, 'b', 'a window that opens on the first slide follows it')
  await post({ index: 2, step: 0, slideId: 'c', at: Date.now(), screen: 'laptop' })
  assert.equal((await state()).slideId, 'c')
  position.flush()
  assert.deepEqual(JSON.parse(readFileSync(position.path, 'utf8')), { slide: 'c' }, 'a slide change is kept')
  position.drop()
  assert.equal(await state(), null, 'starting from the first slide clears the stage room')
})
