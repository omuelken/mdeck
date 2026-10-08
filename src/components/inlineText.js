import { Marked } from 'marked'
import markedKatex from 'marked-katex-extension'

// Short texts in a tag's attributes (a poll's question and options) as one
// line of Markdown with $…$ maths, like the text on a slide. The slide gets
// KaTeX's HTML; the phones' answer page has no KaTeX, so it gets MathML,
// which browsers draw themselves (src/live/answer/answer.js).
const slide = new Marked().use(markedKatex({ throwOnError: false, output: 'html' }))
const phone = new Marked().use(markedKatex({ throwOnError: false, output: 'mathml' }))

export const slideHtml = text => slide.parseInline(String(text ?? ''))
export const phoneHtml = text => phone.parseInline(String(text ?? ''))

// A formula, as KaTeX's inline rule finds it: $…$ or $$…$$, not starting
// with a space, and ending before a space, punctuation, a bar or the end.
const MATH = /^(\${1,2})(?!\$|\s)(?:\\.|[^\\\n$])*?\1(?=[\s?!.,:|]|$)/

/**
 * "A|B|C" as ["A", "B", "C"]. A bar in a formula belongs to it ($|x|$,
 * $\{x \mid x > 0\}$), and \| is a bar in the text. "$5|$10" is two
 * options: neither $ starts a formula.
 */
export function choicesOf(options) {
  const text = String(options ?? '')
  const parts = []
  let part = ''
  for (let i = 0; i < text.length; i++) {
    const math = text[i] === '$' && text.slice(i).match(MATH)
    if (math) { part += math[0]; i += math[0].length - 1 }
    else if (text[i] === '\\' && text[i + 1] === '|') { part += '|'; i++ }
    else if (text[i] === '\\' && i + 1 < text.length) { part += text[i] + text[i + 1]; i++ }
    else if (text[i] === '|') { parts.push(part); part = '' }
    else part += text[i]
  }
  parts.push(part)
  return parts.map(choice => choice.trim()).filter(Boolean)
}
