import { h } from 'preact'
import deckTemplates from 'virtual:deck-templates'
import { builtinManifests, resolveTemplateProps } from './templateManifests'
import { SlideFrame, prepareSlide } from './templateApi'
import { TitleLayout, ChapterLayout, FocusLayout, ImageTextLayout, FullBleedLayout, SplitLayout, GenericLayout } from './builtinLayouts'

const builtins = { title: TitleLayout, chapter: ChapterLayout, focus: FocusLayout,
  'image-text': ImageTextLayout, 'full-bleed-image': FullBleedLayout, split: SplitLayout, generic: GenericLayout }

export const templates = {
  ...Object.fromEntries(Object.entries(builtins).map(([name, render]) => [name, { manifest: builtinManifests[name], render }])),
  ...deckTemplates,
}
export const manifests = Object.fromEntries(Object.entries(templates).map(([name, t]) => [name, t.manifest]))

export function SlideRenderer(slide) {
  const name = slide.meta.layout ?? 'generic'
  const template = Object.hasOwn(templates, name) ? templates[name] : templates.generic
  const prepared = prepareSlide(slide)
  const props = resolveTemplateProps(template.manifest, slide.meta)
  const context = { ...prepared, props, manifest: template.manifest }
  return <SlideFrame {...context}>{h(template.render, context)}</SlideFrame>
}
