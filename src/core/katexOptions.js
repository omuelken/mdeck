// How every part of mdeck reads $…$ maths: `marked.use(...mathExtensions('html'))`.
// marked-katex-extension's standard rule finds a formula only after a space and
// before a space or one of `?!.,:`, so `$x$-Achse`, `($120^\circ$)` or `$n$;`
// stayed raw text, and the stray `$` were then paired wrongly. Here a formula
// is `$…$` or `$$…$$` on one line, wherever it stands, except that it does not
// close right before a digit: `$5 and $10` are two prices, not a formula.
// Write `\$` for a dollar sign in text.
import markedKatex from 'marked-katex-extension'

export const INLINE_MATH = /^(\${1,2})(?!\$)((?:\\.|[^\\\n])*?(?:\\.|[^\\\n$]))\1(?!\d)/

const inlineMath = {
  name: 'inlineKatex',
  level: 'inline',
  start(src) {
    for (let at = src.indexOf('$'); at >= 0; at = src.indexOf('$', at + 1)) if (INLINE_MATH.test(src.slice(at))) return at
  },
  // The extension's own token, so its renderer draws it.
  tokenizer(src) {
    const match = INLINE_MATH.exec(src)
    if (match) return { type: 'inlineKatex', raw: match[0], text: match[2].trim(), displayMode: match[1].length === 2 }
  },
}

/** The extensions for `new Marked().use(...)`: KaTeX's, with the inline rule above in front. */
export const mathExtensions = (output = 'html') => [markedKatex({ throwOnError: false, output }), { extensions: [inlineMath] }]
