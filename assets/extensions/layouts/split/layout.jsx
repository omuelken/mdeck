import { h } from 'preact'
import { marked } from 'marked'
import { HtmlContent, MarkdownRegion } from 'mdeck/layout'

export default function SplitLayout({ content, regions, props }) {
  const tokens = marked.lexer(content)
  const [first, ...rest] = tokens.filter(token => token.type !== 'space')
  const named = regions.left || regions.right
  const left = named ? marked.parse(regions.left?.content ?? '') : marked.parser(Object.assign(first ? [first] : [], { links: tokens.links }))
  const right = named ? marked.parse(regions.right?.content ?? '') : marked.parser(Object.assign(rest, { links: tokens.links }))
  return <>
    {named && content && <MarkdownRegion region={regions.body} />}
    <div class="slide-body">
      <div class="split-left" data-region="left" style={{ flex: props.ratio[0] }}><HtmlContent html={left} /></div>
      <div class="split-right" data-region="right" style={{ flex: props.ratio[1] }}><HtmlContent html={right} /></div>
    </div>
  </>
}
