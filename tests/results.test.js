import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { keptAnswers, answersAsMessages, normalizeResults, withRoom, resultsCsv, resultsFileFor } from '../src/core/results.js'
import { createResultsFile } from '../src/build/resultsPlugin.js'

const messages = [
  { n: 1, at: '2026-10-08T10:00:00.000Z', from: 'uuid-a', data: { value: 'Thai' } },
  { n: 2, at: '2026-10-08T10:00:01.000Z', from: 'uuid-b', data: { value: ['2', '5'] } },
  { n: 3, at: '2026-10-08T10:00:02.000Z', from: 'uuid-a', data: { value: 'Mensa' } },
]

test('kept answers number the phones and keep no device ids', () => {
  const answers = keptAnswers(messages)
  assert.deepEqual(answers.map(answer => [answer.phone, answer.value]), [[1, 'Thai'], [2, ['2', '5']], [1, 'Mensa']])
  assert.doesNotMatch(JSON.stringify(answers), /uuid/)
  // Back as messages, each phone's answers still belong together.
  assert.deepEqual(answersAsMessages(answers).map(message => message.from), ['phone-1', 'phone-2', 'phone-1'])
})

test('a room in, out with no answers, and anything unexpected left out', () => {
  let results = withRoom(normalizeResults({}), 'lunch', { answers: keptAnswers(messages), closed: true })
  assert.equal(results.rooms.lunch.closed, true)
  assert.equal(results.rooms.lunch.answers.length, 3)
  results = withRoom(results, 'lunch', { answers: [] })
  assert.deepEqual(results.rooms, {})
  assert.throws(() => withRoom(results, '../x', { answers: [] }), /Room names/)
  assert.deepEqual(normalizeResults({ rooms: { 'bad room': { answers: [] }, ok: { answers: [{ phone: 1, value: 1 }, { phone: 'x' }] } } }).rooms, { ok: { savedAt: null, closed: false, answers: [{ phone: 1, at: null, value: 1 }] } })
})

test('results as CSV, with several picks joined and quotes escaped', () => {
  const results = withRoom(normalizeResults({}), 'q', { answers: [{ phone: 1, at: 't', value: ['A', 'B'] }, { phone: 2, at: 't', value: 'say "hi", ok' }] })
  assert.equal(resultsCsv(results), 'room,phone,at,answer\nq,1,t,A|B\nq,2,t,"say ""hi"", ok"\n')
})

test('the dev server writes the file beside the deck, and no empty file for a deck without answers', async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'mdeck-results-'))
  const deck = resolve(dir, 'talk.md')
  writeFileSync(deck, '# Talk\n')
  const file = createResultsFile(deck, { debounceMs: 0 })
  assert.equal(file.path, resultsFileFor(deck))
  file.save('lunch', { answers: [] })
  file.flush()
  assert.equal(existsSync(file.path), false)
  file.save('lunch', { answers: keptAnswers(messages) })
  file.flush()
  assert.equal(JSON.parse(readFileSync(file.path, 'utf8')).rooms.lunch.answers.length, 3)
  // A reset takes the room out of an existing file.
  file.save('lunch', { answers: [] })
  file.flush()
  assert.deepEqual(JSON.parse(readFileSync(file.path, 'utf8')).rooms, {})
})
