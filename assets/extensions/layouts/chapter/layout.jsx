import { h } from 'preact'
import { extractContent, HtmlContent, Picture } from 'mdeck/layout'

export default function ChapterLayout({ meta, content, props }) {
  const { headings, paragraphs, bodyHtml } = extractContent(content, { headingLevels: [1], paragraph: meta.description == null })
  // As written: 2 shows as 2; write "02" for a leading zero. A whole number
  // is also given to themes as --chapter-number, for counters in another
  // style (editorial shows it in Roman numerals).
  const num = meta.number != null ? String(meta.number) : null
  const desc = meta.description ?? paragraphs[0]
  return <div class="slide-body">
    <div class="chapter-content">
      {num && <div class="chapter-num" style={/^\d+$/.test(num) ? { '--chapter-number': Number(num) } : undefined}>{num}</div>}
      <div class="chapter-meta">{meta.label ?? 'Chapter'}</div>
      {headings[1] && <h2 class="chapter-title" dangerouslySetInnerHTML={{ __html: headings[1] }} />}
      {desc && <p class="chapter-desc" dangerouslySetInnerHTML={{ __html: desc }} />}
      {bodyHtml && <HtmlContent html={bodyHtml} />}
    </div>
    {props.image && <Picture class="chapter-image" src={props.image} alt={props.alt} fit={props.fit} position={props.position} />}
  </div>
}
