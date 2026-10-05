import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { resolve } from 'node:path'
import { componentFolders, componentFiles } from '../src/build/components.js'
import { checkDeck } from '../src/build/check.js'
import { loadRegistry } from '../src/extensions/discover.js'
import { parseSlides } from '../src/core/parseSlides.js'
import { validateDeck } from '../src/core/validateDeck.js'

const root = mkdtempSync(resolve(tmpdir(), 'mdeck-components-'))
const write = (path, text = 'export default () => null\n') => { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), text) }
write('deck/components/Poll.jsx')
write('shared/Poll.jsx')
write('shared/Chart.jsx')
write('shared/helpers/format.js', 'export const x = 1\n')
write('more/Chart.jsx')
write('more/Quiz.jsx')
const deck = resolve(root, 'deck/talk.md')
writeFileSync(deck, '---\ntheme: neue\ncomponents:\n  - ../shared\n  - ../more\n---\n\n---\n<poll />\n')

test('the deck folder comes first, then listed folders in order', () => {
  const files = componentFiles(deck)
  assert.deepEqual(files.map(f => [f.tag, f.source, f.folder]), [
    ['poll', 'deck', 'components'],
    ['chart', 'shared', '../shared'],
    ['quiz', 'shared', '../more'],
  ])
  assert.equal(files[1].file, resolve(root, 'shared/Chart.jsx'))
})

test('home-relative folders are expanded', () => {
  const folders = componentFolders(deck, '---\ncomponents: [~/mdeck-components]\n---\n\n---\n# A\n')
  assert.equal(folders[1].dir, resolve(homedir(), 'mdeck-components'))
})

test('check reports listed folders that do not exist, and bad settings', () => {
  const source = '---\ntheme: neue\ncomponents:\n  - ../shared\n  - ../gone\n---\n\n---\n# A\n'
  const { diagnostics } = checkDeck(deck, loadRegistry(deck), source)
  assert.deepEqual(diagnostics.map(d => d.code), ['missing-components'])
  assert.match(diagnostics[0].message, /\.\.\/gone/)
  assert.deepEqual(validateDeck(parseSlides('---\ncomponents: ../shared\n---\n\n---\n# A\n')).map(d => d.code), ['invalid-config'])
})
