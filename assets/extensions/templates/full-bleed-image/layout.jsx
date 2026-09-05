import { h } from 'preact'
import { extractContent, HtmlContent } from 'mdeck/template-api'

export default function FullBleedLayout({ content, props }) {
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
