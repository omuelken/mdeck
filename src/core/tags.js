import { Marked } from 'marked'
import markedKatex from 'marked-katex-extension'

// The HTML tags in a deck's Markdown, found the way the slide finds them:
// marked decides what is HTML (not code, not a tag a blank line cut in two),
// and the tags in that HTML are read the way a browser reads them, so a `>`
// in a quoted value (question="Is $x > 0$?") does not end its tag. Every
// part of mdeck that looks for tags in a deck's text goes through here.

const lexer = new Marked().use(markedKatex({ throwOnError: false, output: 'html' }))

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
const decode = value => value.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (entity, dec, hex, name) =>
  dec ? String.fromCodePoint(Number(dec)) : hex ? String.fromCodePoint(parseInt(hex, 16)) : ENTITIES[name.toLowerCase()] ?? entity)

const SPACE = /[\t\n\f\r ]/
// Elements whose content is text, not tags.
const RAW_TEXT = new Set(['script', 'style', 'textarea', 'title'])

/**
 * The tags in a piece of HTML, in order: { name, attrs, spans, raw, index,
 * end, closing, selfClosing }, `spans` giving where each value is in `raw`. Attribute values are decoded and a repeated
 * attribute keeps its first value, as in the browser. Comments are skipped,
 * and a `<` that starts no tag is text.
 */
export function scanTags(html) {
  const tags = []
  let i = 0
  while ((i = html.indexOf('<', i)) >= 0) {
    if (html.startsWith('<!--', i)) {
      const close = html.indexOf('-->', i + 4)
      i = close < 0 ? html.length : close + 3
      continue
    }
    const tag = readTag(html, i)
    if (!tag) { i++; continue }
    tags.push(tag)
    i = tag.end
    if (!tag.closing && !tag.selfClosing && RAW_TEXT.has(tag.name)) {
      const close = html.toLowerCase().indexOf(`</${tag.name}`, i)
      i = close < 0 ? html.length : close
    }
  }
  return tags
}

function readTag(html, start) {
  let i = start + 1
  const closing = html[i] === '/'
  if (closing) i++
  const name = /^[a-z][^\t\n\f\r />]*/i.exec(html.slice(i))?.[0]
  if (!name) return null
  i += name.length
  const attrs = {}
  // Where each attribute's value is in `raw`, as [from, to].
  const spans = {}
  let selfClosing = false
  while (i < html.length) {
    while (SPACE.test(html[i] ?? '')) i++
    if (html[i] === '>') return { name: name.toLowerCase(), attrs, spans, raw: html.slice(start, i + 1), index: start, end: i + 1, closing, selfClosing }
    if (html[i] === '/') { selfClosing = html[i + 1] === '>'; i++; continue }
    if (i >= html.length) break
    selfClosing = false
    let attr = html[i++]
    while (i < html.length && !SPACE.test(html[i]) && !'/>='.includes(html[i])) attr += html[i++]
    while (SPACE.test(html[i] ?? '')) i++
    let value = ''
    let span = [i - start, i - start]
    if (html[i] === '=') {
      i++
      while (SPACE.test(html[i] ?? '')) i++
      const quote = html[i]
      if (quote === '"' || quote === "'") {
        const close = html.indexOf(quote, i + 1)
        if (close < 0) return null
        value = html.slice(i + 1, close)
        span = [i + 1 - start, close - start]
        i = close + 1
      } else {
        const from = i
        while (i < html.length && !SPACE.test(html[i]) && html[i] !== '>') i++
        value = html.slice(from, i)
        span = [from - start, i - start]
      }
    }
    attr = attr.toLowerCase()
    if (!(attr in attrs)) { attrs[attr] = decode(value); spans[attr] = span }
  }
  return null
}

// The children of a token, whatever kind it is.
const childrenOf = token => [
  ...token.tokens ?? [],
  ...token.items ?? [],
  ...(token.header ?? []).flatMap(cell => cell.tokens ?? []),
  ...(token.rows ?? []).flat().flatMap(cell => cell.tokens ?? []),
]

/**
 * The HTML in a piece of Markdown, as marked reads it: [{ text, start }],
 * where `start` is the HTML's offset in the source, or null where it cannot
 * be told (such as a tag spread over several lines of a quotation).
 */
export function htmlIn(markdown = '') {
  const source = String(markdown ?? '').replace(/\r\n?/g, '\n')
  const found = []
  // A child's raw text is found inside its parent's, after its older sibling.
  const walk = (tokens, parent, parentStart) => {
    let cursor = 0
    for (const token of tokens) {
      const at = parentStart == null || token.raw == null ? -1 : parent.indexOf(token.raw, cursor)
      const start = at < 0 ? null : parentStart + at
      if (at >= 0) cursor = at + token.raw.length
      if (token.type === 'html') found.push({ text: token.raw ?? token.text, start })
      const children = childrenOf(token)
      if (children.length) walk(children, token.raw ?? '', start)
    }
  }
  walk(lexer.lexer(source), source, 0)
  return found
}

/**
 * The tags in a piece of Markdown, opening and closing, in order, each with
 * `start` and `end` in the source (null where it cannot be told). Tags in
 * code are not tags.
 */
export function tagsIn(markdown = '') {
  return htmlIn(markdown).flatMap(({ text, start }) => scanTags(text).map(tag => ({
    ...tag,
    start: start == null ? null : start + tag.index,
    end: start == null ? null : start + tag.end,
  })))
}

/**
 * The closing tag of `tags[at]` in a list from tagsIn or scanTags, past any
 * of the same name inside it; null when it has none.
 */
export function closingTagOf(tags, at) {
  const open = tags[at]
  if (open.closing || open.selfClosing) return null
  let depth = 0
  for (const tag of tags.slice(at + 1)) {
    if (tag.name !== open.name || tag.selfClosing) continue
    if (!tag.closing) depth++
    else if (depth) depth--
    else return tag
  }
  return null
}

/**
 * Self-closing tags of the named elements given a closing tag. A browser
 * takes `<poll />` for `<poll>`, so what follows would end up inside it.
 */
export function closeTags(html, names) {
  let out = ''
  let last = 0
  for (const tag of scanTags(html)) {
    if (!tag.selfClosing || !names.has(tag.name)) continue
    out += html.slice(last, tag.index) + tag.raw.replace(/\s*\/>$/, '>') + `</${tag.name}>`
    last = tag.end
  }
  return out + html.slice(last)
}

/** The opening tags (and self-closing ones) in a piece of Markdown. */
export const openTagsIn = markdown => tagsIn(markdown).filter(tag => !tag.closing)

/**
 * Calls `fn(tag)` for every tag in a piece of Markdown and puts what it
 * returns in its place (the tag stays when it returns undefined). Line ends
 * come back as \n.
 */
export function replaceTagsIn(markdown, fn) {
  const source = String(markdown ?? '').replace(/\r\n?/g, '\n')
  let out = ''
  let last = 0
  for (const tag of tagsIn(source)) {
    if (tag.start == null || tag.start < last) continue
    const replacement = fn(tag)
    if (replacement == null) continue
    out += source.slice(last, tag.start) + replacement
    last = tag.end
  }
  return out + source.slice(last)
}

/** A tag's text with one attribute's value replaced (as written, not encoded). */
export function withAttribute(tag, name, value) {
  const [from, to] = tag.spans[name]
  return tag.raw.slice(0, from) + value + tag.raw.slice(to)
}
