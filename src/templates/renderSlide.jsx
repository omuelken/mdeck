import { h } from 'preact'
import { templates } from 'virtual:mdeck-extensions'
import { resolveTemplateProps } from './templateProps'
import { SlideFrame, prepareSlide } from './templateApi'

// Every template — built-in or deck-local — arrives through the same registry.
export { templates }
export const manifests = Object.fromEntries(Object.entries(templates).map(([id, t]) => [id, t.manifest]))

export function SlideRenderer(slide) {
  const id = slide.meta.layout ?? 'generic'
  const template = Object.hasOwn(templates, id) ? templates[id] : templates.generic
  const prepared = prepareSlide(slide)
  const props = resolveTemplateProps(template.manifest, slide.meta)
  const context = { ...prepared, props, manifest: template.manifest }
  return <SlideFrame {...context}>{h(template.render, context)}</SlideFrame>
}
