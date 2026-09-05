import { h } from 'preact'
import { extractContent, HtmlContent } from 'mdeck/template-api'

export default function ImageTextLayout({ meta, content, props }) {
  const { headings, bodyHtml } = extractContent(content, { headingLevels: [1, 2] })
  return <div class="slide-body">
    <div class="image-pane">
      {props.image ? <img src={props.image} alt={props.alt} style={{ objectFit: props.fit, objectPosition: props.position }} />
        : <div class="image-placeholder"><span>Image placeholder</span></div>}
    </div>
    <div class="text-pane">
      {(headings[2] ?? meta.eyebrow) && <div class="eyebrow" dangerouslySetInnerHTML={{ __html: headings[2] ?? meta.eyebrow }} />}
      {headings[1] && <h2 class="title" dangerouslySetInnerHTML={{ __html: headings[1] }} />}
      <HtmlContent class="text-content" html={bodyHtml.replace(/<p>/g, '<p class="body-text">')} />
    </div>
  </div>
}
