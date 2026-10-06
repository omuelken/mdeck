import { h } from 'preact'
import { extractContent, HtmlContent, Picture, themedSvg } from 'mdeck/layout'

export default function FullBleedLayout({ content, props }) {
  const { headings, bodyHtml } = extractContent(content, { headingLevels: [1] })
  // A drawing in the theme's colours is drawn inside the background box;
  // other pictures are its CSS background.
  const drawing = props.image && themedSvg(props.image)
  return <>
    <div class="slide-bg" style={{ backgroundImage: props.image && !drawing ? `url(${JSON.stringify(props.image)})` : undefined,
      backgroundSize: props.fit, backgroundPosition: props.position }}>
      {drawing && <Picture class="slide-bg-picture" src={props.image} alt={props.alt} fit={props.fit ?? 'cover'} />}
    </div>
    <div class="slide-body">
      {headings[1] && <h2 class="overlay-title" dangerouslySetInnerHTML={{ __html: headings[1] }} />}
      {bodyHtml && <HtmlContent html={bodyHtml} />}
    </div>
  </>
}
