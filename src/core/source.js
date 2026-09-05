import yaml from 'js-yaml'
// All ranges are half-open UTF-16 offsets into the original source string.
export function sourceLines(source) {
  const lines = []
  let offset = 0
  for (const raw of source.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
    lines.push({ text: raw.replace(/\r?\n$/, ''), start: offset, end: offset + raw.length })
    offset += raw.length
  }
  return lines
}

export function fenceState(text, fence) {
  const match = text.match(/^ {0,3}(`{3,}|~{3,})(.*)$/)
  if (!match) return fence
  if (!fence) return { char: match[1][0], length: match[1].length }
  if (match[1][0] === fence.char && match[1].length >= fence.length && !match[2].trim()) return null
  return fence
}

export function diagnostic(source, code, message, offset = 0, severity = 'error') {
  const before = source.slice(0, offset)
  return { severity, code, message, offset, line: before.split('\n').length, column: offset - before.lastIndexOf('\n') }
}

// Balanced directive scanner, shared by the document parser and Markdown lexer.
export function scanDirectives(source) {
  const nodes = []
  const stack = []
  const diagnostics = []
  let fence = null
  for (const line of sourceLines(source)) {
    const before = fence
    fence = fenceState(line.text, fence)
    if (before || fence) continue
    const open = line.text.match(/^:::\s*([\w-]+)(.*)$/)
    if (open) {
      const node = { name: open[1], argument: open[2].trim(), start: line.start, bodyStart: line.end, children: [] }
      if (stack.length) stack.at(-1).children.push(node)
      else nodes.push(node)
      stack.push(node)
    } else if (/^:::[ \t]*$/.test(line.text)) {
      const node = stack.pop()
      if (!node) diagnostics.push(diagnostic(source, 'unexpected-close', 'Directive closing fence has no opening fence', line.start))
      else Object.assign(node, { bodyEnd: line.start, end: line.end })
    }
  }
  for (const node of stack) diagnostics.push(diagnostic(source, 'unclosed-directive', `Unclosed :::${node.name} block`, node.start))
  return { nodes, diagnostics }
}

export function applySourceEdits(source, edits) {
  const sorted = [...edits].sort((a, b) => a.start - b.start)
  let end = 0
  for (const edit of sorted) {
    if (!Number.isInteger(edit.start) || !Number.isInteger(edit.end) || edit.start < end || edit.end < edit.start || edit.end > source.length) throw new Error('Invalid or overlapping source edits')
    if (edit.expected != null && source.slice(edit.start, edit.end) !== edit.expected) throw new Error('Source changed since this edit was prepared')
    end = edit.end
  }
  for (const edit of sorted.reverse()) source = source.slice(0, edit.start) + edit.text + source.slice(edit.end)
  return source
}

export function serializeDeck(deck) { return deck.source }

export function replaceRegion(deck, slideId, name, markdown) {
  const slide = deck.slides.find(slide => slide.id === slideId)
  const region = slide?.regions[name]
  if (!region || !region.explicit) throw new Error(`No explicit region "${name}" on slide "${slideId}"`)
  const newline = deck.source.includes('\r\n') ? '\r\n' : '\n'
  const text = markdown.replace(/\r?\n/g, newline).replace(/[\r\n]*$/, '') + newline
  return applySourceEdits(deck.source, [{ ...region.source, text, expected: region.raw }])
}

// ─── Byte-preserving editing primitives ────────────────────────────────────

export function detectNewline(source) { return source.includes('\r\n') ? '\r\n' : '\n' }

// Normalizes line endings and guarantees exactly one trailing newline; '' stays ''.
export function normalizeBlock(text, newline = '\n') {
  if (!text || !text.trim()) return ''
  return text.replace(/\r?\n/g, newline).replace(/[\r\n]*$/, '') + newline
}

const KEY_LINE_RE = /^([\w-]+):(\s|$)/
const TRAIL_LINE_RE = /^\s*(#.*)?$/

export function firstYamlKey(text) {
  for (const line of sourceLines(text)) {
    if (TRAIL_LINE_RE.test(line.text)) continue
    return line.text.match(KEY_LINE_RE)?.[1] ?? null
  }
  return null
}

// Patches top-level keys of a YAML mapping given as full lines. Only the
// blocks of the patched keys are rewritten; every other line stays
// byte-identical, including comments. `undefined` deletes a key. Returns ''
// when no keys remain. `leadKeys` moves a recognized key to the top so
// legacy slide metadata and deck frontmatter keep being detected.
export function patchYamlMapping(text, patch, { newline = detectNewline(text), leadKeys = null } = {}) {
  const existing = text.trim() ? yaml.load(text) : null
  if (existing != null && (typeof existing !== 'object' || Array.isArray(existing))) throw new Error('Metadata must be a YAML mapping')
  const blocks = [{ key: null, lines: [] }]
  for (const line of sourceLines(text)) {
    const key = line.text.match(KEY_LINE_RE)?.[1]
    if (key) blocks.push({ key, lines: [] })
    blocks.at(-1).lines.push(line.text)
  }
  const split = lines => {
    let end = lines.length
    while (end > 0 && TRAIL_LINE_RE.test(lines[end - 1])) end--
    return [lines.slice(0, end), lines.slice(end)]
  }
  const dump = (key, value) => yaml.dump({ [key]: value }, { flowLevel: 2, lineWidth: -1, noRefs: true, quotingType: '"' }).replace(/\n$/, '').split('\n')
  for (const [key, value] of Object.entries(patch)) {
    if (!KEY_LINE_RE.test(`${key}:`)) throw new Error(`Invalid metadata key "${key}"`)
    const index = blocks.findIndex(block => block.key === key)
    if (index < 0) {
      if (value !== undefined) blocks.push({ key, lines: dump(key, value) })
      continue
    }
    const [, trailing] = split(blocks[index].lines)
    if (value === undefined) blocks[index] = { key: null, lines: trailing }
    else blocks[index].lines = [...dump(key, value), ...trailing]
  }
  const keyed = blocks.filter(block => block.key)
  if (!keyed.length) return ''
  if (leadKeys && !leadKeys.has(keyed[0].key)) {
    const lead = keyed.find(block => leadKeys.has(block.key))
    if (lead) {
      blocks.splice(blocks.indexOf(lead), 1)
      blocks.splice(1, 0, lead)
    }
  }
  return blocks.flatMap(block => block.lines).join(newline) + newline
}
