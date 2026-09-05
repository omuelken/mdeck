import { h } from 'preact'
import { extractContent, HtmlContent } from 'mdeck/template-api'

export default function TitleLayout({ content, props }) {
  const { headings, paragraphs, bodyHtml } = extractContent(content, { headingLevels: [1, 2], paragraph: !/^##\s/m.test(content) })
  return <div class="slide-body">
    <div class="title-text">
      {headings[1] && <h1 class="display" dangerouslySetInnerHTML={{ __html: headings[1] }} />}
      {(headings[2] || paragraphs[0]) && <p class="subtitle" dangerouslySetInnerHTML={{ __html: headings[2] ?? paragraphs[0] }} />}
      {bodyHtml && <HtmlContent html={bodyHtml} />}
    </div>
    {props.image && <img class="title-image" src={props.image} alt={props.alt} style={{ objectFit: props.fit, objectPosition: props.position }} />}
  </div>
}
