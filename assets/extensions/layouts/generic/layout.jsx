import { h } from 'preact'
import { MarkdownRegion } from 'mdeck/layout'

export default function GenericLayout({ regions }) {
  if (Object.keys(regions).length === 1 && regions.body) return <MarkdownRegion class="slide-body" region={regions.body} />
  // Unknown legacy layouts retain every region in source order.
  return <div class="slide-body">{Object.values(regions).map(region => <MarkdownRegion key={region.name} region={region} />)}</div>
}
