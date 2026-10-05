import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseSlides } from '../src/core/parseSlides.js'

test('content-only decks retain their first slide and colon text', () => {
  const deck = parseSlides('# First\nHello\n---\nNote: body text')
  assert.deepEqual(deck.deckConfig, {})
  assert.equal(deck.slides.length, 2)
  assert.equal(deck.slides[1].content, 'Note: body text')
})

test('separators and notes inside code remain literal, including CRLF', () => {
  const content = '# Example\r\n\r\n```markdown\r\n---\r\n:::notes\r\nexample\r\n:::\r\n```'
  const deck = parseSlides(content)
  assert.equal(deck.slides.length, 1)
  assert.equal(deck.slides[0].content, content)
  assert.equal(deck.slides[0].meta.notes, undefined)
})

test('notes support nested directives without cutting the slide', () => {
  const deck = parseSlides('# Hello\n:::notes\n:::tip\nRemember\n:::\n---\nMore notes\n:::\n')
  assert.equal(deck.slides.length, 1)
  assert.equal(deck.slides[0].content, '# Hello')
  assert.match(deck.slides[0].meta.notes, /More notes/)
})

test('invalid metadata produces source diagnostics', () => {
  const deck = parseSlides('---\ntheme: neue\n---\n\n---\nlayout: [broken\n---\n# Hello')
  assert.equal(deck.slides.length, 1)
  assert.equal(deck.slides[0].content, '# Hello')
  assert.equal(deck.diagnostics[0].code, 'invalid-yaml')
  assert.ok(deck.diagnostics[0].line >= 6)
})

test('existing examples parse without errors', () => {
  for (const name of ['showcase', 'fhnw', 'python', 'poll']) {
    const deck = parseSlides(readFileSync(new URL(`../examples/${name}/slides.md`, import.meta.url), 'utf8'))
    assert.deepEqual(deck.diagnostics, [], name)
    assert.ok(deck.slides.length > 3, name)
  }
})
