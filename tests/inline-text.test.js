import test from 'node:test'
import assert from 'node:assert/strict'
import { choicesOf, slideHtml, phoneHtml } from '../src/components/inlineText.js'

test('poll options split at bars outside formulas', () => {
  assert.deepEqual(choicesOf(' Mensa | Thai|Pizza||'), ['Mensa', 'Thai', 'Pizza'])
  assert.deepEqual(choicesOf('$|x|$|$x^2$'), ['$|x|$', '$x^2$'])
  assert.deepEqual(choicesOf('$$\\{x \\mid x > 0\\}$$|$\\|v\\|$|y'), ['$$\\{x \\mid x > 0\\}$$', '$\\|v\\|$', 'y'])
  assert.deepEqual(choicesOf('a \\| b|c'), ['a | b', 'c'])
  // Not formulas, as KaTeX's rule sees them: a price, a lone dollar.
  assert.deepEqual(choicesOf('$5|$10'), ['$5', '$10'])
  assert.deepEqual(choicesOf('$ x$|y'), ['$ x$', 'y'])
  assert.deepEqual(choicesOf(undefined), [])
})

test('poll texts render Markdown and maths for the slide and the phones', () => {
  assert.equal(slideHtml('**none**'), '<strong>none</strong>')
  assert.match(slideHtml('$x^2$'), /class="katex-html"/)
  const phone = phoneHtml('$\\frac{x^3}{3}$ or *so*')
  assert.match(phone, /<math[^>]*><semantics><mrow><mfrac>/)
  assert.doesNotMatch(phone, /katex-html/)
  assert.match(phone, /<em>so<\/em>/)
  assert.equal(phoneHtml('Mensa & Thai'), 'Mensa &amp; Thai')
})
