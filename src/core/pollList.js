import { Marked } from 'marked'
import { tagsIn, closingTagOf } from './tags.js'

// A poll's options as a Markdown list inside the tag, for options that are
// more than a word: pictures, long formulas, text with bars in it.
//
//   <poll room="deriv" question="What is $\frac{d}{dx} x^2$?">
//   - [x] $2x$
//   - [ ] $x^2$
//   </poll>
//
// Each item is one option, as written; `[x]` marks a right answer. Before a
// slide is drawn, and before the phones read the tag, such a poll becomes
// `<poll … data-choices="[…]">` with the options as JSON, so Poll needs no
// Markdown of its own to find them. A poll whose content is not a list
// stays as it is.

const lexer = new Marked()

const attributeText = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;')

/**
 * The options of a list, [{ text, right }], or null when `markdown` is not
 * a list. A change of bullet (`-` to `*`) starts a new list in Markdown;
 * here it goes on with the same options.
 */
export function listChoices(markdown) {
  const blocks = lexer.lexer(markdown).filter(token => token.type !== 'space')
  if (!blocks.length || blocks.some(block => block.type !== 'list')) return null
  const choices = blocks.flatMap(block => block.items)
    .map(item => ({ text: item.text.replace(/\s*\n\s*/g, ' ').trim(), right: !!(item.task && item.checked) }))
    // An empty `- [ ]` is no task to marked, but no option either.
    .filter(choice => choice.text && !/^\[[ xX]\]$/.test(choice.text))
  return choices.length ? choices : null
}

/** `markdown` with every poll that holds a list given its options as `data-choices`. */
export function expandPollLists(markdown) {
  const source = String(markdown ?? '')
  if (!/<poll\b/i.test(source)) return source
  const text = source.replace(/\r\n?/g, '\n')
  const tags = tagsIn(text)
  let out = ''
  let last = 0
  tags.forEach((open, at) => {
    if (open.name !== 'poll' || open.closing || open.start == null || open.start < last) return
    const close = closingTagOf(tags, at)
    if (close?.start == null) return
    const choices = listChoices(text.slice(open.end, close.start))
    if (!choices) return
    // The closing tag on a line of its own keeps the tag one block of HTML,
    // as `<poll … />` on its line is, rather than a paragraph.
    out += text.slice(last, open.start) + `${open.raw.slice(0, -1).trimEnd()} data-choices="${attributeText(JSON.stringify(choices))}">\n</poll>`
    last = close.end
  })
  return last ? out + text.slice(last) : source
}

/** The options of a poll from its attributes: the list's, else `options`. */
export function pollChoices(listed) {
  try {
    const choices = JSON.parse(listed)
    if (Array.isArray(choices)) return choices.filter(choice => typeof choice?.text === 'string').map(choice => ({ text: choice.text, right: choice.right === true }))
  } catch {}
  return null
}
