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
