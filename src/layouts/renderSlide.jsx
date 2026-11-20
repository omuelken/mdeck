import { h } from 'preact'
import { layouts } from 'virtual:mdeck-extensions'
import { resolveLayoutProps } from './layoutProps'
import { SlideFrame, prepareSlide } from './layoutApi'
import { includeOf } from '../core/parseSlides.js'
import { SheetStep, SheetPage } from '../runtime/ink/Sheet.jsx'

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

// The slide once more, for its notes sheet: `copy` leaves the sheet out.
const sheetParts = given => ({ id: given.id, copy: <SlideRenderer {...given} copy />, width: given.deckConfig?.width ?? 1920, height: given.deckConfig?.height ?? 1080 })

export function SlideRenderer(given) {
  const slide = includeCard(given)
  const id = slide.meta.layout ?? 'generic'
  const entry = Object.hasOwn(layouts, id) ? layouts[id] : layouts.generic
  const prepared = prepareSlide(slide)
  const props = resolveLayoutProps(entry.manifest, slide.meta)
  // A notes sheet, if the slide's ink has one, is its last step (Sheet.jsx).
  const sheet = given.copy || !given.id ? null : <SheetStep {...sheetParts(given)} />
  const context = { ...prepared, props, manifest: entry.manifest, sheet }
  return <SlideFrame {...context}>{h(entry.render, context)}</SlideFrame>
}

/** The page of a slide's notes sheet, after the slide in print, PDFs and the reader's Read mode. */
export function SlideSheetPage(given) {
  return <SheetPage {...sheetParts(given)} />
}
