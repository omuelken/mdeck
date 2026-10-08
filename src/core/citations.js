import { sourceLines, fenceState } from './source.js'

// Pandoc's citation syntax, shared by the build (which formats the deck's
// citations with citeproc) and the runtime (which puts the formatted text in
// place): `[@smith2020]`, `[see @smith2020, p. 12; @doe2019]`, `[-@smith2020]`
// and narrative `@smith2020` (`Smith (2020)`), optionally `@smith2020 [p. 12]`.
// A narrative `@key` counts only when `isKey` knows it, so e-mail addresses and
// handles stay text. Fenced and inline code are left alone.

const KEY = String.raw`[\w][\w:.#$%&+?<>~/-]*`
// Not a link (`](`, `][ref]`); a footnote may follow (`[@a][^1]`).
const NOT_LINK = String.raw`(?!\(|\[(?!\^))`
const BRACKETED = new RegExp(String.raw`\[([^\[\]\n]*?-?@[\w][^\[\]\n]*?)\]${NOT_LINK}`, 'g')
// The key starts a word: `[info@fhnw.ch]` is an address, not a citation.
const ITEM = new RegExp(String.raw`^((?:.*?\s)?)(-?)@(${KEY})(.*)$`, 's')
const NARRATIVE = new RegExp(String.raw`(?<![\w@\[\]\`])@(${KEY})(?:\s\[([^\[\]\n]+)\]${NOT_LINK})?`, 'g')

// Locator terms readers write after a comma, mapped to CSL labels.
const LOCATORS = [
  [/^(pp?\.?|pages?|S\.|Seiten?)\s*/i, 'page'],
  [/^(chaps?\.?|ch\.|chapters?|Kap\.)\s*/i, 'chapter'],
  [/^(secs?\.?|sections?|§§?)\s*/i, 'section'],
  [/^(figs?\.?|figures?|Abb\.)\s*/i, 'figure'],
  [/^(vols?\.?|volumes?|Bd\.)\s*/i, 'volume'],
  [/^(paras?\.?|paragraphs?|¶¶?)\s*/i, 'paragraph'],
  [/^(nos?\.?|numbers?|Nr\.)\s*/i, 'issue'],
  [/^(ll?\.|lines?)\s*/i, 'line'],
  [/^(eqs?\.?|equations?)\s*/i, 'equation'],
]

// Keys end before trailing punctuation: `@smith2020.` cites `smith2020`.
const trimKey = key => key.replace(/[:.#$%&+?<>~/-]+$/, '')

// `, p. 12, emphasis added` → locator `12`, label `page`, suffix `, emphasis added`.
export function parseLocator(text) {
  const rest = text.replace(/^\s*,?\s*/, '')
  if (!rest) return {}
  for (const [pattern, label] of LOCATORS) {
    const term = rest.match(pattern)
    if (!term) continue
    const value = rest.slice(term[0].length).match(/^[^\s,;]+(?:\s*[-–]\s*[^\s,;]+)?/)
    if (value) return withSuffix({ label, locator: value[0] }, rest.slice(term[0].length + value[0].length))
  }
  const number = rest.match(/^\d[\w]*(?:\s*[-–]\s*\w+)?/)
  if (number) return withSuffix({ label: 'page', locator: number[0] }, rest.slice(number[0].length))
  return { suffix: text.trim() }
}

const withSuffix = (item, suffix) => suffix.trim() ? { ...item, suffix: suffix.trim() } : item

function parseItem(part) {
  const match = part.match(ITEM)
  if (!match) return null
  const id = trimKey(match[3])
  const after = match[3].slice(id.length) + match[4]
  const item = { id, ...parseLocator(after) }
  if (match[1].trim()) item.prefix = match[1].trim()
  if (match[2]) item.suppressAuthor = true
  return item
}

// Ranges of `code` and link targets in a line, which hold no citations.
function codeSpans(text) {
  const spans = []
  const pattern = /(`+)[\s\S]*?\1|\]\([^)\s]*(?:\s[^)]*)?\)/g
  for (let match; (match = pattern.exec(text));) spans.push([match.index, match.index + match[0].length])
  return spans
}

// Every citation in `markdown`, in order: `{ start, end, raw, items, narrative }`.
// `raw` is the text as written, the key the build's formatted output is filed under.
export function scanCitations(markdown, { isKey = () => true } = {}) {
  const found = []
  let fence = null
  for (const line of sourceLines(markdown)) {
    const before = fence
    fence = fenceState(line.text, fence)
    if (before || fence || !line.text.includes('@')) continue
    const code = codeSpans(line.text)
    const taken = []
    const free = (start, end) => ![...code, ...taken].some(([a, b]) => start < b && end > a)
    for (const match of line.text.matchAll(BRACKETED)) {
      const end = match.index + match[0].length
      // `[@key]: …` at the start of a line defines a link reference.
      const definition = line.text[end] === ':' && !line.text.slice(0, match.index).trim()
      if (line.text[match.index - 1] === '!' || definition || !free(match.index, end)) continue
      const items = match[1].split(';').map(parseItem)
      if (items.some(item => !item)) continue
      taken.push([match.index, end])
      found.push({ start: line.start + match.index, end: line.start + end, raw: match[0], items, narrative: false })
    }
    for (const match of line.text.matchAll(NARRATIVE)) {
      const id = trimKey(match[1])
      const keyEnd = match.index + 1 + id.length
      const end = match[2] != null ? match.index + match[0].length : keyEnd
      if (!isKey(id) || !free(match.index, end)) continue
      taken.push([match.index, end])
      const item = { id, ...(match[2] != null ? parseLocator(match[2]) : {}) }
      found.push({ start: line.start + match.index, end: line.start + end, raw: line.text.slice(match.index, end), items: [item], narrative: true })
    }
  }
  return found.sort((a, b) => a.start - b.start)
}

// The cited keys, each once, in order of first citation.
export function citedKeys(clusters) {
  return [...new Set(clusters.flatMap(cluster => cluster.items.map(item => item.id)))]
}
