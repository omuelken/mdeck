import yaml from 'js-yaml'

export function parseSlides(markdown) {
  // Split on lines that are exactly "---"
  const segments = markdown.split(/^---$/m).map(s => s.trim()).filter(Boolean)

  if (segments.length === 0) return { deckConfig: {}, slides: [] }

  // Detect deck config: first block that has no `layout` key
  const firstParsed = yaml.load(segments[0]) || {}
  let deckConfig = {}
  let startIndex = 0

  if (!firstParsed.layout) {
    deckConfig = firstParsed
    startIndex = 1
  }

  // Remaining segments alternate: frontmatter (YAML), content (markdown)
  const slides = []
  for (let i = startIndex; i < segments.length; i += 2) {
    const meta = yaml.load(segments[i]) || {}
    const content = (segments[i + 1] || '').trim()
    slides.push({ meta, content })
  }

  return { deckConfig, slides }
}
