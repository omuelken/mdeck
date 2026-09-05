import { h } from 'preact'
import { extractContent, HtmlContent } from 'mdeck/template-api'

export default function ChapterLayout({ meta, content, props }) {
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
    {props.image && <img class="chapter-image" src={props.image} alt={props.alt} style={{ objectFit: props.fit, objectPosition: props.position }} />}
  </div>
}
