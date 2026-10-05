// Slide titles and the deck outline, shared by the editor and the share view.
import { fenceState } from './source.js'

function firstProseLine(content = '') {
  let fence = null
  for (const raw of content.split(/\r?\n/)) {
    const before = fence
    fence = fenceState(raw, fence)
    if (before || fence) continue
    const line = raw.trim()
    if (line && !/^(:::|\||<|!\[|---)/.test(line)) return line
  }
  return null
}

// `slideName(n)` names a slide without a heading or text for readers
// ("Slide 4"); without it, the layout's title is used, as the editor wants.
export function slideTitle(slide, index, manifest, { slideName = null } = {}) {
  if (slide.meta.title) return slide.meta.title
  const heading = slide.content?.match(/^\s*#{1,3}\s+(.+?)\s*#*\s*$/m)?.[1]
  if (heading) return heading.replace(/[*_`]/g, '')
  const first = firstProseLine(slide.content)
  if (first) return first.replace(/[*_`#>]/g, '').slice(0, 60)
  if (slideName) return slideName(index + 1)
  return manifest?.title ?? slide.meta.layout ?? `Slide ${index + 1}`
}

export function deckOutline(deck, layouts = {}, options = {}) {
  return deck.slides.map((slide, index) => {
    const layout = slide.meta.layout ?? 'generic'
    return { index, id: slide.id, title: slideTitle(slide, index, layouts[layout], options), layout, chapter: layout === 'chapter', part: slide.meta.part ?? null, section: slide.meta.section ?? null, notes: slide.meta.notes ?? '' }
  })
}
