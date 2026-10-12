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

export function SlideRenderer(given) {
  const slide = includeCard(given)
  const id = slide.meta.layout ?? 'generic'
  const entry = Object.hasOwn(layouts, id) ? layouts[id] : layouts.generic
  const prepared = prepareSlide(slide)
  const props = resolveLayoutProps(entry.manifest, slide.meta)
  const context = { ...prepared, props, manifest: entry.manifest }
  return <SlideFrame {...context}>{h(entry.render, context)}</SlideFrame>
}
