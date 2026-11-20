import { h } from 'preact'
import { MarkdownRegion } from 'mdeck/layout'

// The slide before, scaled into the top corner (top right in a right-to-left
// deck); the rest of the page, an L around it, is for writing on.
export default function SheetLayout({ regions, previous, props, deckConfig }) {
  const width = deckConfig?.width ?? 1920, height = deckConfig?.height ?? 1080
  const scale = props.size === '1/2' ? 1 / 2 : 2 / 3
  return <>
    {previous && <div class="sheet-copy" style={{ width: `${width * scale}px`, height: `${height * scale}px` }}>
      <div class="sheet-scale" style={{ width: `${width}px`, height: `${height}px`, transform: `scale(${scale})` }}>{previous}</div>
    </div>}
    <MarkdownRegion class="slide-body sheet-body" region={regions.body ?? ''} style={{ marginInlineStart: `${width * scale}px` }} />
  </>
}
