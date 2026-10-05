import test from 'node:test'
import assert from 'node:assert/strict'
import { LABELS, LABEL_KEYS, setDeckLanguage, deckLanguage, t } from '../src/core/labels.js'
import { parseSlides } from '../src/core/parseSlides.js'
import { validateDeck } from '../src/core/validateDeck.js'
import { deckOutline } from '../src/core/outline.js'

test('every language has every label', () => {
  for (const [lang, labels] of Object.entries(LABELS)) assert.deepEqual(Object.keys(labels).sort(), [...LABEL_KEYS].sort(), lang)
})

test('lang picks the label set and labels override single entries', () => {
  setDeckLanguage({ lang: 'de-CH', labels: { 'poll.scan': 'Jetzt abstimmen', 'poll.nope': 'ignored', 'poll.reset': 3 } })
  assert.equal(deckLanguage(), 'de-CH')
  assert.equal(t('reader.read'), 'Lesen')
  assert.equal(t('poll.scan'), 'Jetzt abstimmen')
  assert.equal(t('poll.reset'), 'Zurücksetzen')
  assert.equal(t('poll.answers', { n: 3 }), '3 Antworten')
  setDeckLanguage({ lang: 'fr' })
  assert.equal(deckLanguage(), 'fr')
  assert.equal(t('reader.read'), 'Read', 'languages without labels fall back to English')
  setDeckLanguage()
  assert.equal(deckLanguage(), 'en')
})

test('placeholders can hold elements', () => {
  setDeckLanguage({ lang: 'en' })
  const code = { type: 'code' }
  assert.deepEqual(t('poll.unreachable', { command: code, setting: 'x' }), ['Phones cannot reach this computer. Start with ', code, ', or set ', 'x', '.'])
  assert.equal(t('poll.thanks', {}), 'Thanks! You chose “{choice}”. Tap another to change.')
})

test('lang and labels are validated', () => {
  const codes = config => validateDeck(parseSlides(`---\n${config}\n---\n\n---\n# A\n`)).map(d => [d.code, d.severity])
  assert.deepEqual(codes('lang: de\nlabels:\n  poll.scan: Abstimmen'), [])
  assert.deepEqual(codes('lang: Deutsch'), [['invalid-config', 'error']])
  assert.deepEqual(codes('labels:\n  poll.scann: x'), [['invalid-config', 'warning']])
  assert.deepEqual(codes('labels:\n  poll.scan: [a]'), [['invalid-config', 'error']])
})

test('readers see a numbered name for slides without a heading', () => {
  const deck = parseSlides('---\ntheme: neue\n---\n\n---\n<netzwerk />\n')
  assert.deepEqual(deckOutline(deck, {}, { slideName: n => `Folie ${n}` }).map(item => item.title), ['Folie 1'])
  assert.deepEqual(deckOutline(deck).map(item => item.title), ['Slide 1'])
})
