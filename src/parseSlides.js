import yaml from 'js-yaml'

function safeYamlLoad(s) {
  try { return yaml.load(s) } catch { return null }
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

const NOTES_RE = /^:::notes[ \t]*\n([\s\S]*?)\n:::[ \t]*(?:\n|$)/gm

function extractNotes(content) {
  const noteBlocks = []
  const cleaned = content.replace(NOTES_RE, (_, body) => {
    noteBlocks.push(body.trim())
    return ''
  })
  return {
    content: noteBlocks.length > 0 ? cleaned.trim() : content,
    notes: noteBlocks.length > 0 ? noteBlocks.join('\n\n') : null,
  }
}

export function parseSlides(markdown) {
  const segments = markdown.split(/^---$/m).map(s => s.trim()).filter(Boolean)

  if (segments.length === 0) return { deckConfig: {}, slides: [] }

  // Detect deck config: first block that has no `layout` key
  const firstParsed = safeYamlLoad(segments[0]) || {}
  let deckConfig = {}
  let i = 0

  if (!firstParsed.layout) {
    deckConfig = firstParsed
    i = 1
  }

  const slides = []
  while (i < segments.length) {
    const parsed = safeYamlLoad(segments[i])

    if (isPlainObject(parsed)) {
      // Frontmatter block — pair with the next segment if it's content
      const next = segments[i + 1]
      if (next && !isPlainObject(safeYamlLoad(next))) {
        const { content, notes } = extractNotes(next)
        if (notes && !parsed.note) parsed.note = notes
        slides.push({ meta: parsed, content })
        i += 2
      } else {
        slides.push({ meta: parsed, content: '' })
        i += 1
      }
    } else {
      // Not a YAML object — content-only slide, no frontmatter needed
      const { content, notes } = extractNotes(segments[i])
      slides.push({ meta: notes ? { note: notes } : {}, content })
      i += 1
    }
  }

  // Propagate section names forward from chapter slides (via part:) and explicit section: overrides
  let currentSection = null
  for (const slide of slides) {
    if (slide.meta.layout === 'chapter' && slide.meta.part) {
      currentSection = slide.meta.part
    } else if (slide.meta.section) {
      currentSection = slide.meta.section
    } else if (currentSection) {
      slide.meta.section = currentSection
    }
  }

  return { deckConfig, slides }
}
