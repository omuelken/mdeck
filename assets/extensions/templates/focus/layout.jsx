import { h } from 'preact'
import { MarkdownRegion } from 'mdeck/template-api'

export default function FocusLayout({ meta, regions }) {
  return <div class="slide-body">
    {meta.eyebrow && <div class="focus-eyebrow">{meta.eyebrow}</div>}
    <MarkdownRegion class="focus-content" region={regions.body} />
    {meta.attribution && <div class="focus-attribution">— {meta.attribution}</div>}
  </div>
}
