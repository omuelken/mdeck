import { h } from 'preact'
import { marked } from 'marked'
import { extractContent, HtmlContent, MarkdownRegion } from './templateApi'

function imageStyle(props) { return { objectFit: props.fit, objectPosition: props.position } }

export function TitleLayout({ content, props }) {
  const { headings, paragraphs, bodyHtml } = extractContent(content, { headingLevels: [1, 2], paragraph: !/^##\s/m.test(content) })
  return <div class="slide-body">
    <div class="title-text">
      {headings[1] && <h1 class="display" dangerouslySetInnerHTML={{ __html: headings[1] }} />}
      {(headings[2] || paragraphs[0]) && <p class="subtitle" dangerouslySetInnerHTML={{ __html: headings[2] ?? paragraphs[0] }} />}
      {bodyHtml && <HtmlContent html={bodyHtml} />}
    </div>
    {props.image && <img class="title-image" src={props.image} alt={props.alt} style={imageStyle(props)} />}
  </div>
}

export function ChapterLayout({ meta, content, props }) {
  const { headings, paragraphs, bodyHtml } = extractContent(content, { headingLevels: [1], paragraph: meta.description == null })
  const num = meta.number != null ? String(meta.number).padStart(2, '0') : null
  const desc = meta.description ?? paragraphs[0]
  return <div class="slide-body">
    <div class="chapter-content">
      {num && <div class="chapter-num">{num}</div>}
      <div class="chapter-meta">{meta.label ?? 'Chapter'}</div>
      {headings[1] && <h2 class="chapter-title" dangerouslySetInnerHTML={{ __html: headings[1] }} />}
      {desc && <p class="chapter-desc" dangerouslySetInnerHTML={{ __html: desc }} />}
      {bodyHtml && <HtmlContent html={bodyHtml} />}
    </div>
    {props.image && <img class="chapter-image" src={props.image} alt={props.alt} style={imageStyle(props)} />}
  </div>
}

export function FocusLayout({ meta, regions }) {
  return <div class="slide-body">
    {meta.eyebrow && <div class="focus-eyebrow">{meta.eyebrow}</div>}
    <MarkdownRegion class="focus-content" region={regions.body} />
    {meta.attribution && <div class="focus-attribution">— {meta.attribution}</div>}
  </div>
}

export function ImageTextLayout({ meta, content, props }) {
  const { headings, bodyHtml } = extractContent(content, { headingLevels: [1, 2] })
  return <div class="slide-body">
    <div class="image-pane">
      {props.image ? <img src={props.image} alt={props.alt} style={imageStyle(props)} />
        : <div class="image-placeholder"><span>Image placeholder</span></div>}
    </div>
    <div class="text-pane">
      {(headings[2] ?? meta.eyebrow) && <div class="eyebrow" dangerouslySetInnerHTML={{ __html: headings[2] ?? meta.eyebrow }} />}
      {headings[1] && <h2 class="title" dangerouslySetInnerHTML={{ __html: headings[1] }} />}
      <HtmlContent class="text-content" html={bodyHtml.replace(/<p>/g, '<p class="body-text">')} />
    </div>
  </div>
}

export function FullBleedLayout({ content, props }) {
  const { headings, bodyHtml } = extractContent(content, { headingLevels: [1] })
  return <>
    <div class="slide-bg" style={{ backgroundImage: props.image ? `url(${JSON.stringify(props.image)})` : undefined,
      backgroundSize: props.fit, backgroundPosition: props.position }} />
    <div class="slide-body">
      {headings[1] && <h2 class="overlay-title" dangerouslySetInnerHTML={{ __html: headings[1] }} />}
      {bodyHtml && <HtmlContent html={bodyHtml} />}
    </div>
  </>
}

export function SplitLayout({ content, regions, props }) {
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

export function GenericLayout({ regions }) {
  if (Object.keys(regions).length === 1 && regions.body) return <MarkdownRegion class="slide-body" region={regions.body} />
  // Unknown legacy layouts retain every region in source order.
  return <div class="slide-body">{Object.values(regions).map(region => <MarkdownRegion key={region.name} region={region} />)}</div>
}
