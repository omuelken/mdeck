import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { keptAnswers, answersAsMessages, normalizeResults, withRoom, resultsCsv, resultsFileFor } from '../src/core/results.js'
import { createResultsFile } from '../src/build/resultsPlugin.js'
import { activitiesIn, resultsReport, reportAnswersCsv, reportSummaryCsv, reportJson } from '../src/core/resultsReport.js'
import { parseSlides } from '../src/core/parseSlides.js'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

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

const pollDeck = `---
meta:
  title: Lunch talk
---
---
# Where shall we eat?

<poll room="lunch" options="Mensa|Thai|Pizza" />

---
# How was it?

<scale room="pace" question="How was the pace?" min="1" max="5" />

---
# Words

<wordcloud room="words" />

\`\`\`html
<poll room="code" options="A|B" />
\`\`\`
`

test('a report names the slide and question of each room, and sums it up as the slide does', () => {
  const deck = parseSlides(pollDeck)
  assert.deepEqual(activitiesIn(deck).map(activity => [activity.room, activity.slide, activity.kind, activity.question]), [
    ['lunch', 1, 'poll', 'Where shall we eat?'],
    ['pace', 2, 'scale', 'How was the pace?'],
    ['words', 3, 'words', 'Words'],
  ], 'a tag in a code block asks nothing')
  let results = normalizeResults({})
  // Phone 1 changes its mind: only its last vote counts.
  results = withRoom(results, 'lunch', { answers: [{ phone: 1, at: 't1', value: 'Mensa' }, { phone: 2, at: 't2', value: 'Thai' }, { phone: 1, at: 't3', value: 'Thai' }, { phone: 3, at: 't4', value: 'Sushi' }] })
  results = withRoom(results, 'pace', { answers: [{ phone: 1, at: 't', value: 4 }, { phone: 2, at: 't', value: 5 }, { phone: 3, at: 't', value: 2 }] })
  results = withRoom(results, 'words', { answers: [{ phone: 1, at: 't', value: 'Fast' }, { phone: 2, at: 't', value: 'fast ' }, { phone: 1, at: 't', value: 'clear' }] })
  results = withRoom(results, 'old', { answers: [{ phone: 1, at: 't', value: 'x' }] })
  const report = resultsReport(results, deck)
  assert.deepEqual(report.map(entry => entry.room), ['lunch', 'pace', 'words', 'old'], 'in slide order, rooms no longer asked last')
  assert.deepEqual(report[0].summary.counts, [{ answer: 'Mensa', count: 0 }, { answer: 'Thai', count: 2 }, { answer: 'Pizza', count: 0 }])
  assert.equal(report[0].summary.phones, 3)
  assert.equal(report[0].summary.voted, 2, 'an option the poll does not have does not count')
  assert.equal(report[1].summary.average, 3.67)
  assert.equal(report[1].summary.median, 4)
  assert.deepEqual(report[2].summary.counts, [{ answer: 'clear', count: 1 }, { answer: 'fast', count: 1 }], 'a word cloud counts each phone\'s latest word: phone 1 changed to clear')
  assert.equal(report[3].slide, null)

  const answers = reportAnswersCsv(report).split('\n')
  assert.equal(answers[0], 'slide,room,kind,question,phone,at,answer')
  assert.equal(answers[1], '1,lunch,poll,Where shall we eat?,1,t1,Mensa')
  const summary = reportSummaryCsv(report).split('\n')
  assert.equal(summary[0], 'slide,room,kind,question,answer,count,share')
  assert.ok(summary.includes('1,lunch,poll,Where shall we eat?,Thai,2,100%'))
  assert.ok(summary.includes('2,pace,scale,How was the pace?,average,3.67,'))
  const json = JSON.parse(reportJson(report, { title: 'Lunch talk', exportedAt: 'now' }))
  assert.equal(json.title, 'Lunch talk')
  assert.equal(json.questions[0].answers.length, 4)
  assert.doesNotMatch(JSON.stringify(json), /uuid/)
})

test('mdeck results prints the answers with their questions, a summary, or JSON', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'mdeck-results-cli-'))
  const deck = resolve(dir, 'talk.md')
  writeFileSync(deck, pollDeck)
  writeFileSync(resultsFileFor(deck), JSON.stringify(withRoom(normalizeResults({}), 'lunch', { answers: [{ phone: 1, at: 't', value: 'Pizza' }] })))
  const run = (...args) => execFileSync(process.execPath, [fileURLToPath(new URL('../bin/mdeck.js', import.meta.url)), 'results', deck, ...args], { encoding: 'utf8' })
  assert.match(run(), /^slide,room,kind,question,phone,at,answer\n1,lunch,poll,Where shall we eat\?,1,t,Pizza\n$/)
  assert.match(run('--summary'), /1,lunch,poll,Where shall we eat\?,Pizza,1,100%/)
  assert.equal(JSON.parse(run('--json')).questions[0].question, 'Where shall we eat?')
  run('-o', resolve(dir, 'out.json'))
  assert.equal(JSON.parse(readFileSync(resolve(dir, 'out.json'), 'utf8')).title, 'Lunch talk')
})
