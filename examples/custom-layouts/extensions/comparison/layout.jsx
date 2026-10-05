import { h } from 'preact'
import { MarkdownRegion } from 'mdeck/layout'

export default function Comparison({ regions, props }) {
  return <div class="slide-body comparison-body">
    <MarkdownRegion region={regions.body} />
    <div class="comparison-options" style={{ gridTemplateColumns: `${props.ratio[0]}fr ${props.ratio[1]}fr` }}>
      {['left', 'right'].map(name => <MarkdownRegion
        key={name}
        region={regions[name]}
        class={`comparison-option${props.emphasis === name ? ' is-emphasized' : ''}`}
      />)}
    </div>
  </div>
}
