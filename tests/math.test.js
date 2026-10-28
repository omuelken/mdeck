import test from 'node:test'
import assert from 'node:assert/strict'
import { Marked } from 'marked'
import { mathExtensions } from '../src/core/katexOptions.js'
import { parseSlides } from '../src/core/parseSlides.js'
import { mathDiagnostics } from '../src/build/mathCheck.js'
import { slideHtml } from '../src/components/inlineText.js'

const marked = new Marked().use(...mathExtensions('html'))
const raw = html => html.includes('$')
const problems = source => mathDiagnostics(parseSlides(source), source)

test('a formula next to a dash, a semicolon or a bracket is rendered', () => {
  // The cases of issue #34.
  for (const text of [
    'senkrecht auf die $x$-Achse gefällt, bei $(1,\\,0)$; senkrecht unter $y$',
    'singulär: $\\operatorname{Rg}(\\mathbf A) = n$; singulär heisst $\\det A = 0$.',
    'auf $a$ selbst ($120^\\circ$), also $b$',
  ]) {
    const html = marked.parseInline(text)
    assert.ok(!raw(html), text)
    assert.ok(html.includes('class="katex"'))
  }
  assert.ok(!raw(slideHtml('Ist $x$-Achse $(1,0)$; ($2x$)?')))
})

test('a dollar sign written \\$ stays a dollar sign', () => {
  assert.equal(marked.parseInline('costs \\$5 and \\$6').includes('katex'), false)
  assert.match(marked.parseInline('costs \\$5 and \\$6'), /\$5 and \$6/)
})

test('mdeck check reports maths that does not show, in slides and in notes, with its line', () => {
  const source = [
    '# One', '', 'fine: $x^2$ and ($y$)-axis', '', '---', '# Two', '', 'The price is $5 in total', '',
    ':::notes', 'a broken one $\\frac{1$ here', ':::', '', '---', '# Three', '', '`$code$` and \\$5 are fine', '',
  ].join('\n')
  const found = problems(source)
  assert.deepEqual(found.map(d => [d.code, d.severity, d.line]), [['unrendered-math', 'warning', 8], ['unrendered-math', 'warning', 11]])
  assert.match(found[0].message, /\$ that starts no formula/)
  assert.match(found[1].message, /\\frac\{1.*cannot be rendered/)
})

test('a deck without a problem in its maths is not reported', () => {
  assert.deepEqual(problems('# A\n\n$$\nx^2\n$$\n\n$a$, $b$-Achse; ($c$)\n\n:::notes\nnotiz $d$-Wert\n:::\n'), [])
})

test('prices stay prices: a formula does not close before a digit', () => {
  assert.ok(!marked.parseInline('from $5 to $10').includes('katex'))
  assert.ok(!marked.parseInline('$5|$10').includes('katex'))
  assert.ok(marked.parseInline('$5$ and $x$10').includes('katex'))
})
