import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { releaseNotes, shapeEntry } from '../tools/release-notes.mjs'

const CHANGELOG = `# Changelog

## 2.1.0 — 2026-10-07

Better presenting.

- The timer reads the clock.
- Rehearse a talk.
- Fixed: a laser stopped short.
  It now arrives whole.
- Fixed on slides from right to left: drawings.
- Polls show results.

## 2.0.0 — 2026-10-05

A cleaner interface.

### Breaking changes

- \`mdeck dev\` is \`mdeck run\`.

## 1.0.1 — 2026-10-01

- Fixed: the reader.
`

test('a plain list of changes is put under new and fixed, after its opening paragraph', () => {
  const notes = releaseNotes('2.1.0', { changelog: CHANGELOG })
  assert.equal(notes, `Better presenting.

### New and improved

- The timer reads the clock.
- Rehearse a talk.
- Polls show results.

### Fixed

- Fixed: a laser stopped short.
  It now arrives whole.
- Fixed on slides from right to left: drawings.

Update with \`npm install -g mdeck\`. Details in [CHANGELOG.md](https://github.com/tilman-schieber/mdeck/blob/main/CHANGELOG.md#210--2026-10-07).
`)
})

test('an entry with its own sections, or a short one, is used as written', () => {
  assert.match(releaseNotes('2.0.0', { changelog: CHANGELOG }), /^A cleaner interface\.\n\n### Breaking changes\n\n- `mdeck dev` is `mdeck run`\.\n\nUpdate with/)
  assert.equal(shapeEntry('- Fixed: the reader.'), '- Fixed: the reader.')
})

test('notes written for the release come first, the changelog linked for every change', () => {
  const notes = releaseNotes('2.1.0', { changelog: CHANGELOG, written: '## Time your talk\n\nRehearse it.\n' })
  assert.equal(notes, '## Time your talk\n\nRehearse it.\n\nUpdate with `npm install -g mdeck`. Every change in detail in [CHANGELOG.md](https://github.com/tilman-schieber/mdeck/blob/main/CHANGELOG.md#210--2026-10-07).\n')
})

test('a version the changelog does not have is refused', () => {
  assert.throws(() => releaseNotes('9.9.9', { changelog: CHANGELOG }), /no entry for 9\.9\.9/)
})

test('every version in the changelog gives notes', () => {
  const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8')
  for (const [, version] of changelog.matchAll(/^## (\d+\.\d+\.\d+) /gm)) assert.match(releaseNotes(version, { changelog }), /Update with/)
})
