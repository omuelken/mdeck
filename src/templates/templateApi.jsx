import { h } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { render } from 'preact'
import { marked, Parser } from 'marked'
import { registry } from '../runtime/registry'

// ─── Content extraction ────────────────────────────────────────────────────

const FN_DEF_RE = /^\[\^([^\]\n]+)\]:\s+([^\n]+)/gm
const FN_REF_RE = /\[\^([^\]\n]+)\]/g

function preprocessFootnotes(markdown) {
  const defs = {}
  const stripped = markdown.replace(FN_DEF_RE, (_, label, text) => {
    defs[label] = text.trim()
    return ''
  })

  let counter = 0
  const labelToNum = {}
  const processed = stripped.replace(FN_REF_RE, (_, label) => {
    if (labelToNum[label] === undefined) labelToNum[label] = ++counter
    return `<sup>${labelToNum[label]}</sup>`
  })

  if (counter === 0) return { processed: markdown, footnotesHtml: '' }

  const items = Object.keys(labelToNum)
    .map(label => `<li>${marked.parseInline(defs[label] ?? label)}</li>`)
    .join('')

  return { processed, footnotesHtml: `<ol>${items}</ol>` }
}

export function extractContent(markdown, { headingLevels = [], paragraph = false } = {}) {
  const processed = markdown
  const footnotesHtml = ''
  const tokens = marked.lexer(processed)
  const headings = {}
  const paragraphs = []
  const remaining = []

  for (const token of tokens) {
    if (token.type === 'heading' && headingLevels.includes(token.depth) && headings[token.depth] == null) {
      headings[token.depth] = Parser.parseInline(token.tokens)
    } else if (token.type === 'paragraph' && paragraph && paragraphs.length === 0 && !headings[2]) {
      paragraphs.push(Parser.parseInline(token.tokens))
    } else remaining.push(token)
  }

  const fullHtml = marked.parse(processed)
  const bodyHtml = marked.parser(Object.assign(remaining, { links: tokens.links }))
  return { headings, paragraphs, bodyHtml, fullHtml, footnotesHtml }
}

// ─── Hydration for inline components ──────────────────────────────────────

export function HtmlContent({ html, class: className, ...attributes }) {
  const ref = useRef()

  useEffect(() => {
    if (!ref.current) return
    const mounted = []
    for (const [name, Component] of Object.entries(registry)) {
      for (const el of [...ref.current.querySelectorAll(name)]) {
        const props = Object.fromEntries([...el.attributes].map(a => [a.name, a.value]))
        const children = el.textContent
        const wrapper = document.createElement('div')
        el.replaceWith(wrapper)
        render(h(Component, { ...props, children }), wrapper)
        mounted.push(wrapper)
      }
    }
    return () => mounted.forEach(wrapper => render(null, wrapper))
  }, [html])

  return <div class={className} {...attributes} ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
}

// ─── Header / footer / footnotes rails ────────────────────────────────────

function SlideHeader({ deckConfig, right, logo, isTitle = false }) {
  const org = deckConfig.meta?.organization ?? ''

  // institution: 'title' (default) | 'all' | 'none'
  const instSetting = deckConfig.institution ?? 'title'
  const showOrg = instSetting === 'all' || (instSetting === 'title' && isTitle)

  // sections: 'all' (default) | 'none'
  const showSection = (deckConfig.sections ?? 'all') !== 'none'

  return (
    <div class="slide-header">
      <span class="brand">{showOrg ? org : ''}</span>
      {logo && <img class="slide-logo" src={logo} alt="" />}
      {showSection && right != null && <span>{right}</span>}
    </div>
  )
}

function SlideFooter({ deckConfig, left, right, isTitle = false }) {
  const { author, date } = deckConfig.meta ?? {}
  const authorStr = [author, date].filter(Boolean).join(' · ')

  // authorDate: 'title' (default) | 'all' | 'none'
  const adSetting = deckConfig.authorDate ?? 'title'
  const showAuthor = adSetting === 'all' || (adSetting === 'title' && isTitle)

  // pageNumbers: 'slides' (default = all-except-title) | 'all' | 'none'
  const pnSetting = deckConfig.pageNumbers ?? 'slides'
  const showRight = pnSetting === 'all' || (pnSetting === 'slides' && !isTitle)

  const leftContent = left ?? (showAuthor ? authorStr : '')
  const footerClass = leftContent ? 'slide-footer' : 'slide-footer slide-footer--no-meta'

  return (
    <div class={footerClass}>
      <span>{leftContent}</span>
      {right != null && showRight && <span>{right}</span>}
    </div>
  )
}

function SlideFootnotes({ html }) {
  if (!html) return null
  return <div class="slide-footnotes" dangerouslySetInnerHTML={{ __html: html }} />
}

function slideNum(index) {
  return String(index + 1).padStart(2, '0')
}


export function prepareSlide(slide) {
  const position = region => region.source?.start ?? region.ranges?.[0]?.start ?? 0
  const entries = Object.entries(slide.regions ?? { body: { name: 'body', content: slide.content } })
    .sort((a, b) => position(a[1]) - position(b[1]))
  let separator = '\u0000mdeck-region\u0000'
  while (entries.some(([, r]) => r.content.includes(separator))) separator += '\u0000'
  const { processed, footnotesHtml } = preprocessFootnotes(entries.map(([, r]) => r.content).join(separator))
  const pieces = processed.split(separator)
  const regions = Object.fromEntries(entries.map(([name, region], i) => [name, { ...region, content: pieces[i] }]))
  return { ...slide, regions, content: regions.body?.content ?? '', footnotesHtml }
}

export function MarkdownRegion({ region, content, class: className, ...attributes }) {
  const name = typeof region === 'object' ? region.name : undefined
  const markdown = content ?? (typeof region === 'string' ? region : region?.content) ?? ''
  return <HtmlContent class={className} data-region={name} {...attributes} html={marked.parse(markdown)} />
}

// Layouts supply body content; every template receives the same outer frame.
export function SlideFrame({ meta = {}, props = {}, deckConfig = {}, index = 0, id, manifest, footnotesHtml, children }) {
  const layout = manifest.name === 'generic' ? meta.layout : manifest.name
  const frame = manifest.frame ?? 'standard'
  const title = frame === 'title'
  const image = props.image
  const classes = ['slide', layout && 'slide--' + String(layout).replace(/[^a-zA-Z0-9_-]/g, '-'),
    image && ['title', 'chapter'].includes(layout) && 'has-image',
    layout === 'full-bleed-image' && props.overlay && 'has-overlay'].filter(Boolean).join(' ')
  return <section class={classes} data-slide-id={id} data-label={`${slideNum(index)} ${manifest.title}`}>
    {frame !== 'none' && <SlideHeader deckConfig={deckConfig} logo={title ? deckConfig.meta?.logo : undefined}
      isTitle={title} right={frame === 'chapter' ? meta.part ?? '' : meta.section ?? ''} />}
    {children}
    <SlideFootnotes html={footnotesHtml} />
    {frame !== 'none' && <SlideFooter deckConfig={deckConfig} right={slideNum(index)} isTitle={title} />}
  </section>
}
