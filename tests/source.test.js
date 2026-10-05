import test from 'node:test'
import assert from 'node:assert/strict'
import { parseSlides } from '../src/core/parseSlides.js'
import { serializeDeck, replaceRegion, applySourceEdits, scanDirectives } from '../src/core/source.js'
import { validateDeck } from '../src/core/validateDeck.js'

const source = '---\r\ntheme: neue\r\n---\r\n\r\n---\r\n:::meta\r\nlayout: split\r\nid: compare\r\n# preserve this comment\r\n:::\r\n# Compare\r\n\r\n:::slot left\r\n**Before**\r\n:::\r\n\r\n:::slot right\r\n:::tip\r\nAfter\r\n:::\r\n:::\r\n'

test('document model round trips unchanged and retains original region ranges', () => {
  const deck = parseSlides(source)
  assert.deepEqual(deck.diagnostics, [])
  assert.equal(serializeDeck(deck), source)
  assert.equal(deck.slides[0].id, 'compare')
  const region = deck.slides[0].regions.left
  assert.equal(source.slice(region.source.start, region.source.end), '**Before**\r\n')
  assert.equal(deck.slides[0].regions.body.content, '# Compare')
})

test('editing one region preserves all other bytes and CRLF', () => {
  const deck = parseSlides(source)
  const edited = replaceRegion(deck, 'compare', 'left', '- New\n- Content')
  assert.equal(edited, source.replace('**Before**\r\n', '- New\r\n- Content\r\n'))
  assert.equal(parseSlides(edited).slides[0].regions.right.content, ':::tip\r\nAfter\r\n:::')
})

test('targeted edits reject overlap and stale source', () => {
  assert.throws(() => applySourceEdits('abcd', [{ start: 0, end: 3, text: '' }, { start: 2, end: 4, text: '' }]), /overlapping/)
  assert.throws(() => applySourceEdits('abcd', [{ start: 0, end: 1, text: '', expected: 'z' }]), /changed/)
})

test('explicit metadata accepts custom fields while colon prose remains content', () => {
  const deck = parseSlides(':::meta\ncustom: true\n:::\nNote: actual prose')
  assert.equal(deck.slides[0].meta.custom, true)
  assert.equal(deck.slides[0].content, 'Note: actual prose')
})

test('malformed and duplicate regions report errors', () => {
  for (const input of [':::slot left\nUnclosed', ':::slot left\nOne\n:::\n:::slot left\nTwo\n:::']) {
    assert.ok(parseSlides(input).diagnostics.length)
  }
  assert.equal(scanDirectives('```\n:::slot left\n```').diagnostics.length, 0)
})

test('validation reports duplicate IDs and invalid dimensions and metadata', () => {
  const deck = parseSlides('---\nwidth: -1\n---\n---\n:::meta\nid: same\nlayout: split\n:::\nFirst\n---\n:::meta\nid: same\nprops: nope\n:::\nSecond')
  const codes = validateDeck(deck).map(d => d.code)
  assert.ok(codes.includes('duplicate-id'))
  assert.ok(codes.includes('invalid-config'))
  assert.ok(codes.includes('invalid-props'))
})
