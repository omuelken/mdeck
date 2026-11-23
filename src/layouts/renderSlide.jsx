import { h } from 'preact'
import { layouts } from 'virtual:mdeck-extensions'
import { resolveLayoutProps } from './layoutProps'
import { SlideFrame, prepareSlide } from './layoutApi'
import { includeOf } from '../core/parseSlides.js'
import { PageSteps, ExtraPages } from '../runtime/ink/Room.jsx'

// Every layout — built-in or deck-local — arrives through the same registry.
export { layouts }
export const manifests = Object.fromEntries(Object.entries(layouts).map(([id, t]) => [id, t.manifest]))

// An include that reaches the page is one the deck was not expanded for: the
// editor works on the file as written (build/include.js). It shows as a card
// naming the file, in the editor's own words.
function includeCard(slide) {
  const include = includeOf(slide.content)
  if (!include) return slide
  const content = `## Slides from \`${include.file}\`\n\n${include.slides ? `Slides ${include.slides} of that file appear` : 'The slides of that file appear'} here when the deck is presented. Edit them in that file.`
  return { ...slide, content, regions: { ...slide.regions, body: { ...slide.regions?.body, name: 'body', content, explicit: false } } }
}

// The page number each slide shows: a layout with `numbered = false` (a blank
// page) shows none, and the others count on as if it were not there.
export function pageNumbers(slides) {
  let page = 0
  return slides.map(slide => {
    const id = slide.meta?.layout ?? 'generic'
    return (Object.hasOwn(layouts, id) ? layouts[id] : layouts.generic).manifest.numbered === false ? null : ++page
  })
}

// What SlideRenderer takes for each slide of a deck.
export function slideProps(slides, deckConfig) {
  const pages = pageNumbers(slides)
  return slides.map((slide, index) => ({ id: slide.id, regions: slide.regions, meta: slide.meta, content: slide.content, deckConfig, index, page: pages[index], total: slides.length }))
}

export function SlideRenderer(given) {
  const slide = includeCard(given)
  const id = slide.meta.layout ?? 'generic'
  const entry = Object.hasOwn(layouts, id) ? layouts[id] : layouts.generic
  const prepared = prepareSlide(slide)
  const props = resolveLayoutProps(entry.manifest, slide.meta)
  // The slide's blank pages, if its ink has any, are its last steps (Room.jsx);
  // `copy` is the slide alone, as its room's page shows it.
  const pages = given.copy || !given.id ? null : <PageSteps id={given.id} />
  const context = { ...prepared, props, manifest: entry.manifest, pages }
  return <SlideFrame {...context}>{h(entry.render, context)}</SlideFrame>
}

/**
 * The pages that follow a slide in print, PDFs and the reader's Read mode:
 * the expanded slide with its room, and its blank pages (Room.jsx).
 */
export function SlideExtraPages({ wrap, ...given }) {
  return <ExtraPages id={given.id} copy={<SlideRenderer {...given} copy />} width={given.deckConfig?.width ?? 1920} height={given.deckConfig?.height ?? 1080} wrap={wrap} />
}
