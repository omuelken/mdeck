import { h } from 'preact'
import { layouts } from 'virtual:mdeck-extensions'
import { resolveLayoutProps } from './layoutProps'
import { SlideFrame, prepareSlide } from './layoutApi'

// Every layout — built-in or deck-local — arrives through the same registry.
export { layouts }
export const manifests = Object.fromEntries(Object.entries(layouts).map(([id, t]) => [id, t.manifest]))

export function SlideRenderer(slide) {
  const id = slide.meta.layout ?? 'generic'
  const entry = Object.hasOwn(layouts, id) ? layouts[id] : layouts.generic
  const prepared = prepareSlide(slide)
  const props = resolveLayoutProps(entry.manifest, slide.meta)
  const context = { ...prepared, props, manifest: entry.manifest }
  return <SlideFrame {...context}>{h(entry.render, context)}</SlideFrame>
}
