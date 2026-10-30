import { h } from 'preact'
import { MarkdownRegion } from 'mdeck/layout'

export default function BlankLayout({ regions }) {
  return <MarkdownRegion class="slide-body" region={regions.body ?? ''} />
}
