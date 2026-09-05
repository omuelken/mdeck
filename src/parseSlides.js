import yaml from 'js-yaml'

const DECK_KEYS = new Set('design palette accent accent2 params meta width height institution authorDate pageNumbers sections lang callouts'.split(' '))
const SLIDE_KEYS = new Set('layout id section number part description label image alt overlay eyebrow attribution note notes props'.split(' '))

export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

// Offsets always refer to the original string (including CRLF and whitespace).
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

function segmentsOf(source) {
  const segments = []
  let start = 0
  let fence = null
  let depth = 0
  for (const line of sourceLines(source)) {
    const before = fence
    fence = fenceState(line.text, fence)
    if (before || fence) continue
    if (/^:::\s*[\w-]+/.test(line.text)) depth++
    else if (/^:::\s*$/.test(line.text)) depth = Math.max(0, depth - 1)
    if (!depth && /^---[ \t]*$/.test(line.text)) {
      segments.push({ start, end: line.start, delimiterEnd: line.end })
      start = line.end
    }
  }
  segments.push({ start, end: source.length, delimiterEnd: source.length })
  return segments.filter(s => source.slice(s.start, s.end).trim())
}

function looksLikeMeta(text, keys) {
  return sourceLines(text).some(({ text }) => {
    const key = text.match(/^([\w-]+):/)
    return key && keys.has(key[1])
  }) && !/^\s*(?:#{1,6}\s|```|~~~|:::)/.test(text)
}

function extractNotes(content) {
  const lines = sourceLines(content)
  const edits = []
  const notes = []
  let fence = null
  let depth = 0
  let start = null
  for (const line of lines) {
    const before = fence
    fence = fenceState(line.text, fence)
    if (before || fence) continue
    if (/^:::notes[ \t]*$/.test(line.text) && depth === 0) start = line
    if (/^:::\s*[\w-]+/.test(line.text)) depth++
    else if (/^:::[ \t]*$/.test(line.text)) {
      depth = Math.max(0, depth - 1)
      if (start && depth === 0) {
        notes.push(content.slice(start.end, line.start).trim())
        edits.push({ start: start.start, end: line.end })
        start = null
      }
    }
  }
  for (const edit of edits.reverse()) content = content.slice(0, edit.start) + content.slice(edit.end)
  return { content: content.trim(), notes: notes.join('\n\n') }
}

export function parseSlides(source) {
  const segments = segmentsOf(source)
  const diagnostics = []
  const text = segment => source.slice(segment.start, segment.end).trim()
  const readMeta = segment => {
    try {
      const value = yaml.load(source.slice(segment.start, segment.end))
      if (!isPlainObject(value)) throw new Error('Metadata must be a YAML mapping')
      return value
    } catch (error) {
      const offset = segment.start + (error.mark?.position ?? 0)
      diagnostics.push({ severity: 'error', code: 'invalid-yaml', message: error.reason ?? error.message, offset, line: source.slice(0, offset).split('\n').length })
      return {}
    }
  }
  let deckConfig = {}
  let i = 0
  if (segments[0] && /^\s*---[ \t]*\r?\n/.test(source) && looksLikeMeta(text(segments[0]), DECK_KEYS) && !looksLikeMeta(text(segments[0]), SLIDE_KEYS)) {
    deckConfig = readMeta(segments[0])
    i++
  }
  const slides = []
  while (i < segments.length) {
    const segment = segments[i++]
    let meta = {}
    let body = segment
    if (looksLikeMeta(text(segment), SLIDE_KEYS)) {
      meta = readMeta(segment)
      body = segments[i]
      if (body && !looksLikeMeta(text(body), SLIDE_KEYS)) i++
      else body = null
    }
    const { content, notes } = extractNotes(body ? text(body) : '')
    if (notes && meta.notes == null && meta.note == null) meta.notes = notes
    slides.push({ meta, content })
  }
  let currentSection = null
  for (const slide of slides) {
    if (slide.meta.layout === 'chapter' && slide.meta.part) currentSection = slide.meta.part
    else if (Object.hasOwn(slide.meta, 'section')) currentSection = slide.meta.section
    else if (currentSection) slide.meta.section = currentSection
  }
  return { deckConfig, slides, diagnostics }
}
