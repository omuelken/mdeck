// Maths that will not show as maths: `mdeck check` reads every slide's text,
// speaker notes included, the way the deck does (src/core/katexOptions.js) and
// reports a formula KaTeX cannot read and a `$` that starts no formula. Both
// show as raw text or red error text, and in notes nobody sees it before the talk.
import { Marked } from 'marked'
import katex from 'katex'
import { mathExtensions } from '../core/katexOptions.js'

const reader = new Marked().use(...mathExtensions('html'))

// The text of one slide body (its content, regions and :::notes), with the
// line of the body's first character; the findings name their line in the file.
function bodyProblems(text, firstLine) {
  const problems = []
  let offset = 0
  const lineAt = at => firstLine + text.slice(0, at).split('\n').length - 1
  for (const block of reader.lexer(text)) {
    const here = offset
    offset += block.raw.length
    reader.walkTokens([block], token => {
      const at = here + Math.max(0, block.raw.indexOf(token.raw))
      if (token.type === 'inlineKatex' || token.type === 'blockKatex') {
        try { katex.renderToString(token.text, { throwOnError: true, displayMode: token.displayMode }) } catch (error) {
          problems.push({ line: lineAt(at), message: `The formula $${token.text}$ cannot be rendered: ${String(error.message).replace(/^KaTeX parse error: /, '')}` })
        }
      } else if (token.type === 'text' && !token.tokens && token.text.includes('$')) {
        problems.push({ line: lineAt(at + Math.max(0, token.raw.indexOf('$'))), message: 'A $ that starts no formula is shown as it is; write \\$ for a dollar sign, or close the formula with a $ on the same line' })
      }
    })
  }
  return problems
}

/** Warnings for the maths in a parsed deck (parseSlides): { code, message, line, column, severity }. */
export function mathDiagnostics(deck, source) {
  const diagnostics = []
  for (const slide of deck.slides) {
    const body = slide.bodySource
    if (!body) continue
    const text = source.slice(body.start, body.end)
    if (!text.includes('$')) continue
    const firstLine = source.slice(0, body.start).split('\n').length
    for (const { line, message } of bodyProblems(text, firstLine)) diagnostics.push({ severity: 'warning', code: 'unrendered-math', message, line, column: 1 })
  }
  return diagnostics
}
