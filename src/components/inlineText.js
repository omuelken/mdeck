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

/** An activity's question for the phones: the text, and drawn when the tag has one (else the slide's heading, as text). */
export const phoneQuestion = (question, slideTitle) => question ? { question, questionHtml: phoneHtml(question) } : { question: slideTitle }

// A formula, as KaTeX's inline rule finds it: $…$ or $$…$$, not starting
// with a space, and ending before a space, punctuation, a bar or the end.
const MATH = /^(\${1,2})(?!\$|\s)(?:\\.|[^\\\n$])*?\1(?=[\s?!.,:|]|$)/

// Reads options as Markdown, with formulas as one piece each, to find the
// bars between them.
const splitter = new Marked().use({ extensions: [{
  name: 'math',
  level: 'inline',
  start: src => src.indexOf('$') < 0 ? undefined : src.indexOf('$'),
  tokenizer: src => { const math = MATH.exec(src); if (math) return { type: 'math', raw: math[0] } },
}] })

// Text, emphasis and strikethrough are split at their bars; code, formulas,
// links, pictures and tags are whole, and `\|` is a bar in the text.
const SPLIT = new Set(['text', 'em', 'strong', 'del'])
function splitTokens(tokens, parts) {
  for (const token of tokens) {
    if (token.type === 'escape' && token.text === '|') parts[parts.length - 1] += '|'
    else if (SPLIT.has(token.type) && token.tokens?.length) {
      const inner = token.tokens.map(child => child.raw).join('')
      const at = token.raw.indexOf(inner)
      if (at < 0) { splitText(token.raw, parts); continue }
      parts[parts.length - 1] += token.raw.slice(0, at)
      splitTokens(token.tokens, parts)
      parts[parts.length - 1] += token.raw.slice(at + inner.length)
    } else if (SPLIT.has(token.type)) splitText(token.raw, parts)
    else parts[parts.length - 1] += token.raw
  }
}
function splitText(text, parts) {
  const [first, ...rest] = text.split('|')
  parts[parts.length - 1] += first
  parts.push(...rest)
}

/**
 * "A|B|C" as ["A", "B", "C"], each as written. A bar in a formula belongs to
 * it ($|x|$, $\{x \mid x > 0\}$), as does one in `code`, a [link](…) or a
 * picture; \| is a bar in the text. "$5|$10" is two options: neither $
 * starts a formula. Emphasis does not hold a bar: "2*3|4*5" is two options.
 */
export function choicesOf(options) {
  const parts = ['']
  splitTokens(splitter.Lexer.lexInline(String(options ?? ''), splitter.defaults), parts)
  return parts.map(choice => choice.trim()).filter(Boolean)
}
