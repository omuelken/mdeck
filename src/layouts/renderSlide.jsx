import { h } from 'preact'
import { layouts } from 'virtual:mdeck-extensions'
import { resolveLayoutProps } from './layoutProps'
import { SlideFrame, prepareSlide } from './layoutApi'
import { includeOf } from '../core/parseSlides.js'

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
// page added during the talk) shows none, and the others count on as if it
// were not there.
export function pageNumbers(slides) {
  let page = 0
  return slides.map(slide => {
    const id = slide.meta?.layout ?? 'generic'
    return (Object.hasOwn(layouts, id) ? layouts[id] : layouts.generic).manifest.numbered === false ? null : ++page
  })
}

// What SlideRenderer takes for each slide of a deck. `previous` is the slide
// before, for a layout that shows it (the notes sheet).
export function slideProps(slides, deckConfig) {
  const pages = pageNumbers(slides)
  const list = []
  slides.forEach((slide, index) => list.push({ id: slide.id, regions: slide.regions, meta: slide.meta, content: slide.content, deckConfig, index, page: pages[index], total: slides.length, previous: list[index - 1] ?? null }))
  return list
}

// A layout's `previous`: the slide before, as a still copy with every step
// shown, its drawings, and no controls (data-deck-static); base.css hides its
// page number. It is drawn only by a layout that places it.
const slideCopy = previous => previous && <div class="slide-copy" data-slide-copy data-deck-static inert aria-hidden="true"><SlideRenderer {...previous} /></div>

export function SlideRenderer(given) {
  const slide = includeCard(given)
  const id = slide.meta.layout ?? 'generic'
  const entry = Object.hasOwn(layouts, id) ? layouts[id] : layouts.generic
  const prepared = prepareSlide(slide)
  const props = resolveLayoutProps(entry.manifest, slide.meta)
  const context = { ...prepared, previous: slideCopy(given.previous), props, manifest: entry.manifest }
  return <SlideFrame {...context}>{h(entry.render, context)}</SlideFrame>
}
