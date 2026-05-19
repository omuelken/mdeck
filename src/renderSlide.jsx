import { h } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { render } from 'preact'
import { marked, Parser } from 'marked'
import { registry } from './registry'

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

function extractContent(markdown) {
  const { processed, footnotesHtml } = preprocessFootnotes(markdown)
  const tokens = marked.lexer(processed)
  const headings = {}
  const paragraphs = []
  const lists = []

  for (const token of tokens) {
    if (token.type === 'heading') {
      headings[token.depth] = Parser.parseInline(token.tokens)
    } else if (token.type === 'paragraph') {
      paragraphs.push(Parser.parseInline(token.tokens))
    } else if (token.type === 'list') {
      lists.push(token)
    }
  }

  const fullHtml = marked.parse(processed)
  return { headings, paragraphs, lists, fullHtml, footnotesHtml }
}

// ─── Hydration for inline components ──────────────────────────────────────

function HtmlContent({ html, class: className }) {
  const ref = useRef()

  useEffect(() => {
    if (!ref.current) return
    for (const [name, Component] of Object.entries(registry)) {
      for (const el of [...ref.current.querySelectorAll(name)]) {
        const props = Object.fromEntries([...el.attributes].map(a => [a.name, a.value]))
        const children = el.textContent
        const wrapper = document.createElement('div')
        el.replaceWith(wrapper)
        render(h(Component, { ...props, children }), wrapper)
      }
    }
  }, [html])

  return <div class={className} ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
}

// ─── Header / footer / footnotes rails ────────────────────────────────────

function SlideHeader({ deckConfig, right, logo, isTitle = false }) {
  const org = deckConfig.meta?.organization ?? ''

  // institution: 'title' (default) | 'all' | 'none'
  const instSetting = deckConfig.institution ?? 'title'
  const showOrg = instSetting === 'all' || (instSetting === 'title' && isTitle)

  return (
    <div class="slide-header">
      <span class="brand">{showOrg ? org : ''}</span>
      {logo && <img class="slide-logo" src={logo} alt="" />}
      {right != null && <span>{right}</span>}
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

  return (
    <div class="slide-footer">
      <span>{left ?? (showAuthor ? authorStr : '')}</span>
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

// ─── Slide layout components ───────────────────────────────────────────────

function TitleSlide({ meta, content, deckConfig, index }) {
  const { headings, paragraphs, footnotesHtml } = extractContent(content)
  const logo = deckConfig.meta?.logo

  return (
    <section class="slide slide--title" data-label={`${slideNum(index)} Title`}>
      <SlideHeader deckConfig={deckConfig} logo={logo} isTitle={true} />
      <div class="slide-body">
        {headings[1] && <h1 class="display" dangerouslySetInnerHTML={{ __html: headings[1] }} />}
        {(headings[2] || paragraphs[0]) && (
          <p class="subtitle" dangerouslySetInnerHTML={{ __html: headings[2] ?? paragraphs[0] }} />
        )}
      </div>
      <SlideFootnotes html={footnotesHtml} />
      <SlideFooter deckConfig={deckConfig} right={slideNum(index)} isTitle={true} />
    </section>
  )
}

function ChapterSlide({ meta, content, deckConfig, index }) {
  const { headings, paragraphs, footnotesHtml } = extractContent(content)
  const num = meta.number != null ? String(meta.number).padStart(2, '0') : null
  const desc = meta.description ?? paragraphs[0]

  return (
    <section class="slide slide--chapter" data-label={`${slideNum(index)} Chapter`}>
      <SlideHeader deckConfig={deckConfig} right={meta.part ?? ''} />
      <div class="slide-body">
        {num && <div class="chapter-num">{num}</div>}
        <div class="chapter-meta">{meta.label ?? 'Chapter'}</div>
        {headings[1] && (
          <h2 class="chapter-title" dangerouslySetInnerHTML={{ __html: headings[1] }} />
        )}
        {desc && (
          <p class="chapter-desc" dangerouslySetInnerHTML={{ __html: desc }} />
        )}
      </div>
      <SlideFootnotes html={footnotesHtml} />
      <SlideFooter deckConfig={deckConfig} right={slideNum(index)} />
    </section>
  )
}

function FocusSlide({ meta, content, deckConfig, index }) {
  const { fullHtml, footnotesHtml } = extractContent(content)

  return (
    <section class="slide slide--focus" data-label={`${slideNum(index)} Focus`}>
      <SlideHeader deckConfig={deckConfig} right={meta.section ?? ''} />
      <div class="slide-body">
        {meta.eyebrow && <div class="focus-eyebrow">{meta.eyebrow}</div>}
        <HtmlContent class="focus-content" html={fullHtml} />
        {meta.attribution && (
          <div class="focus-attribution">— {meta.attribution}</div>
        )}
      </div>
      <SlideFootnotes html={footnotesHtml} />
      <SlideFooter deckConfig={deckConfig} right={slideNum(index)} />
    </section>
  )
}

function ImageTextSlide({ meta, content, deckConfig, index }) {
  const { headings, paragraphs, footnotesHtml } = extractContent(content)

  return (
    <section class="slide slide--image-text" data-label={`${slideNum(index)} Image+Text`}>
      <SlideHeader deckConfig={deckConfig} right={meta.section ?? ''} />
      <div class="slide-body">
        <div class="image-pane">
          {meta.image
            ? <img src={meta.image} alt={meta.alt ?? ''} />
            : <div class="image-placeholder"><span>Image placeholder</span></div>
          }
        </div>
        <div class="text-pane">
          {(headings[2] ?? meta.eyebrow) && (
            <div class="eyebrow" dangerouslySetInnerHTML={{ __html: headings[2] ?? meta.eyebrow }} />
          )}
          {headings[1] && (
            <h2 class="title" dangerouslySetInnerHTML={{ __html: headings[1] }} />
          )}
          {paragraphs.map((p, i) => (
            <p key={i} class="body-text" dangerouslySetInnerHTML={{ __html: p }} />
          ))}
        </div>
      </div>
      <SlideFootnotes html={footnotesHtml} />
      <SlideFooter deckConfig={deckConfig} right={slideNum(index)} />
    </section>
  )
}


function FullBleedImageSlide({ meta, content, deckConfig, index }) {
  const { headings, footnotesHtml } = extractContent(content)
  const hasOverlay = !!meta.overlay
  const classes = ['slide', 'slide--full-bleed-image', hasOverlay && 'has-overlay']
    .filter(Boolean).join(' ')

  return (
    <section class={classes} data-label={`${slideNum(index)} Image`}>
      <div
        class="slide-bg"
        style={meta.image ? { backgroundImage: `url(${meta.image})` } : undefined}
      />
      <div class="slide-body">
        {headings[1] && (
          <h2 class="overlay-title" dangerouslySetInnerHTML={{ __html: headings[1] }} />
        )}
      </div>
      <SlideFootnotes html={footnotesHtml} />
    </section>
  )
}

// Split: first block token goes left, remaining tokens go right
function SplitSlide({ meta, content, deckConfig, index }) {
  const { processed, footnotesHtml } = preprocessFootnotes(content)
  const allTokens = marked.lexer(processed)
  const [firstToken, ...restTokens] = allTokens
  const leftTokens = Object.assign(firstToken ? [firstToken] : [], { links: allTokens.links })
  const rightTokens = Object.assign(restTokens, { links: allTokens.links })
  const leftHtml = marked.parser(leftTokens)
  const rightHtml = marked.parser(rightTokens)

  return (
    <section class="slide slide--split" data-label={`${slideNum(index)} Split`}>
      <SlideHeader deckConfig={deckConfig} right={meta.section ?? ''} />
      <div class="slide-body">
        <div class="split-left">
          <HtmlContent html={leftHtml} />
        </div>
        <div class="split-right">
          <HtmlContent html={rightHtml} />
        </div>
      </div>
      <SlideFootnotes html={footnotesHtml} />
      <SlideFooter deckConfig={deckConfig} right={slideNum(index)} />
    </section>
  )
}

// Fallback: renders raw markdown with component hydration support
function GenericSlide({ meta, content, deckConfig, index }) {
  const { fullHtml, footnotesHtml } = extractContent(content)
  return (
    <section class="slide" data-label={`${slideNum(index)}`}>
      <SlideHeader deckConfig={deckConfig} right={meta.section ?? ''} />
      <HtmlContent class="slide-body" html={fullHtml} />
      <SlideFootnotes html={footnotesHtml} />
      <SlideFooter deckConfig={deckConfig} right={slideNum(index)} />
    </section>
  )
}

// ─── Dispatcher ────────────────────────────────────────────────────────────

const LAYOUTS = {
  title: TitleSlide,
  chapter: ChapterSlide,
  focus: FocusSlide,
  'image-text': ImageTextSlide,
  'full-bleed-image': FullBleedImageSlide,
  split: SplitSlide,
}

export function SlideRenderer({ meta, content, deckConfig, index, total }) {
  const Layout = LAYOUTS[meta.layout] ?? GenericSlide
  return h(Layout, { meta, content, deckConfig, index, total })
}
