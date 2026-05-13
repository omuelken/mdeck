import { h } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { render } from 'preact'
import { marked } from 'marked'
import { registry } from './registry'

// ─── Content extraction ────────────────────────────────────────────────────

function extractContent(markdown) {
  const tokens = marked.lexer(markdown)
  const headings = {}
  const paragraphs = []
  const lists = []

  for (const token of tokens) {
    if (token.type === 'heading') {
      headings[token.depth] = marked.parseInline(token.text)
    } else if (token.type === 'paragraph') {
      paragraphs.push(marked.parseInline(token.text))
    } else if (token.type === 'list') {
      lists.push(token)
    }
  }

  return { headings, paragraphs, lists, fullHtml: marked.parse(markdown) }
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
        const wrapper = document.createElement('span')
        el.replaceWith(wrapper)
        render(h(Component, { ...props, children }), wrapper)
      }
    }
  }, [html])

  return <div class={className} ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
}

// ─── Header / footer rails ─────────────────────────────────────────────────

function SlideHeader({ deckConfig, right }) {
  const org = deckConfig.meta?.organization ?? ''
  return (
    <div class="slide-header">
      <span class="brand">{org}</span>
      {right != null && <span>{right}</span>}
    </div>
  )
}

function SlideFooter({ deckConfig, left, right }) {
  const { author, date } = deckConfig.meta ?? {}
  const defaultLeft = [author, date].filter(Boolean).join(' · ')
  return (
    <div class="slide-footer">
      <span>{left ?? defaultLeft}</span>
      {right != null && <span>{right}</span>}
    </div>
  )
}

function slideNum(index) {
  return String(index + 1).padStart(2, '0')
}

// ─── Slide layout components ───────────────────────────────────────────────

function TitleSlide({ meta, content, deckConfig, index }) {
  const { headings, paragraphs } = extractContent(content)
  const year = deckConfig.meta?.date?.split('-')[0] ?? new Date().getFullYear()
  const authorParts = [deckConfig.meta?.author, deckConfig.meta?.role].filter(Boolean)

  return (
    <section class="slide slide--title" data-label={`${slideNum(index)} Title`}>
      <SlideHeader deckConfig={deckConfig} right={String(year)} />
      <div class="slide-body">
        <div class="title-rule" />
        {headings[1] && <h1 class="display" dangerouslySetInnerHTML={{ __html: headings[1] }} />}
        {(headings[2] || paragraphs[0]) && (
          <p class="subtitle" dangerouslySetInnerHTML={{ __html: headings[2] ?? paragraphs[0] }} />
        )}
      </div>
      <SlideFooter
        deckConfig={deckConfig}
        left={authorParts.join(' · ')}
        right={deckConfig.meta?.date ?? ''}
      />
    </section>
  )
}

function ChapterSlide({ meta, content, deckConfig, index }) {
  const { headings, paragraphs } = extractContent(content)
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
      <SlideFooter deckConfig={deckConfig} right={slideNum(index)} />
    </section>
  )
}

function FocusSlide({ meta, content, deckConfig, index }) {
  const { fullHtml } = extractContent(content)

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
      <SlideFooter deckConfig={deckConfig} right={slideNum(index)} />
    </section>
  )
}

function ImageTextSlide({ meta, content, deckConfig, index }) {
  const { headings, paragraphs } = extractContent(content)

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
      <SlideFooter deckConfig={deckConfig} right={slideNum(index)} />
    </section>
  )
}

function BulletListSlide({ meta, content, deckConfig, index }) {
  const { headings, lists } = extractContent(content)
  const items = lists[0]?.items ?? []

  return (
    <section class="slide slide--bullet-list" data-label={`${slideNum(index)} List`}>
      <SlideHeader deckConfig={deckConfig} right={meta.section ?? ''} />
      <div class="slide-body">
        {headings[1] && (
          <h2 dangerouslySetInnerHTML={{ __html: headings[1] }} />
        )}
        {items.length > 0 && (
          <ul>
            {items.map((item, i) => (
              <li key={i} dangerouslySetInnerHTML={{ __html: marked.parseInline(item.text) }} />
            ))}
          </ul>
        )}
      </div>
      <SlideFooter deckConfig={deckConfig} right={slideNum(index)} />
    </section>
  )
}

function FullBleedImageSlide({ meta, content, deckConfig, index }) {
  const { headings } = extractContent(content)
  const hasOverlay = !!meta.overlay
  const classes = ['slide', 'slide--full-bleed-image', hasOverlay && 'has-overlay']
    .filter(Boolean).join(' ')

  return (
    <section class={classes} data-label={`${slideNum(index)} Image`}>
      {meta.image && (
        <div class="slide-bg" style={{ backgroundImage: `url(${meta.image})` }} />
      )}
      <div class="slide-body">
        {headings[1] && (
          <h2 class="overlay-title" dangerouslySetInnerHTML={{ __html: headings[1] }} />
        )}
      </div>
    </section>
  )
}

// Fallback: renders raw markdown with component hydration support
function GenericSlide({ meta, content, deckConfig, index }) {
  const { fullHtml } = extractContent(content)
  return (
    <section class="slide" data-label={`${slideNum(index)}`}>
      <SlideHeader deckConfig={deckConfig} right={meta.section ?? ''} />
      <HtmlContent class="slide-body" html={fullHtml} />
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
  'bullet-list': BulletListSlide,
  'full-bleed-image': FullBleedImageSlide,
}

export function SlideRenderer({ meta, content, deckConfig, index, total }) {
  const Layout = LAYOUTS[meta.layout] ?? GenericSlide
  return h(Layout, { meta, content, deckConfig, index, total })
}
