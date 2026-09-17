import { h } from 'preact'
import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { marked } from 'marked'
import { deckOutline } from '../core/outline.js'
import { manifests, SlideRenderer } from '../templates/renderSlide'
import { loadTheme, THEME_METAS, PALETTES } from './themeLoader'
import './share.css'

// The reader view for decks sent around by email: outline, the slides at a
// comfortable size or stacked for reading, a look picker, PDF and a way back
// into the full-screen deck.

const lookKey = deckConfig => `mdeck-share-look:${deckConfig.meta?.title ?? location.pathname}`

function restoreLook(deckConfig) {
  const fallback = { design: THEME_METAS[deckConfig.design] ? deckConfig.design : 'neue', palette: PALETTES[deckConfig.palette] ? deckConfig.palette : '' }
  try {
    const stored = JSON.parse(localStorage.getItem(lookKey(deckConfig)) ?? 'null')
    if (stored && THEME_METAS[stored.design] && (!stored.palette || PALETTES[stored.palette])) return stored
  } catch {}
  return fallback
}

function pdfLink() {
  return document.querySelector('link[rel="alternate"][type="application/pdf"]')?.getAttribute('href') ?? null
}

function initialIndex(slides) {
  const hash = decodeURIComponent(location.hash.slice(1))
  const byId = slides.findIndex(slide => slide.id === hash)
  if (byId >= 0) return byId
  const n = parseInt(hash, 10)
  return Number.isInteger(n) && n >= 1 && n <= slides.length ? n - 1 : 0
}

function ReadPage({ slide, index, total, deckConfig, width, height, scale, showNotes }) {
  const notes = slide.meta.notes ?? slide.meta.note ?? ''
  return <article class="share-page" id={`share-page-${index}`}>
    <div class="share-page-frame" style={{ aspectRatio: `${width} / ${height}` }}>
      <div class="share-page-scale" style={{ width: `${width}px`, height: `${height}px`, transform: `scale(${scale})` }}>
        <SlideRenderer id={slide.id} regions={slide.regions} meta={slide.meta} content={slide.content} deckConfig={deckConfig} index={index} total={total} />
      </div>
    </div>
    {showNotes && notes && <div class="share-page-notes" dangerouslySetInnerHTML={{ __html: marked.parse(notes) }} />}
  </article>
}

export function ShareView({ deck, deckConfig }) {
  const { slides } = deck
  const width = deckConfig.width ?? 1920, height = deckConfig.height ?? 1080
  const [look, setLook] = useState(() => restoreLook(deckConfig))
  const [mode, setMode] = useState('slides')
  const [index, setIndex] = useState(() => initialIndex(slides))
  const [navOpen, setNavOpen] = useState(false)
  const [lookOpen, setLookOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [readScale, setReadScale] = useState(0.5)
  const stageRef = useRef(null)
  const readRef = useRef(null)
  const outline = useMemo(() => deckOutline(deck, manifests), [deck])
  const themedConfig = { ...deckConfig, design: look.design, palette: look.palette, accent: undefined, accent2: undefined }
  const pickerAllowed = deckConfig.share?.themes !== false
  const pdf = useMemo(pdfLink, [])
  // Notes stay private unless the deck opts in; a file may carry them for the presenter.
  const showNotes = deckConfig.share?.notes === true && slides.some(slide => slide.meta.notes || slide.meta.note)

  useEffect(() => {
    loadTheme(themedConfig).catch(error => console.warn(error.message))
    try { localStorage.setItem(lookKey(deckConfig), JSON.stringify(look)) } catch {}
  }, [look.design, look.palette])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const onChange = event => setIndex(event.detail.index)
    stage.addEventListener('slidechange', onChange)
    return () => stage.removeEventListener('slidechange', onChange)
  }, [mode])

  useEffect(() => {
    if (mode !== 'read' || !readRef.current) return
    const measure = () => { const page = readRef.current?.querySelector('.share-page'); if (page) setReadScale(page.clientWidth / width) }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(readRef.current)
    return () => observer.disconnect()
  }, [mode, width])

  useEffect(() => {
    if (mode !== 'read') return
    const container = readRef.current
    if (!container) return
    const pages = [...container.querySelectorAll('.share-page')]
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      if (visible) setIndex(pages.indexOf(visible.target))
    }, { root: container, threshold: [0.5] })
    pages.forEach(page => observer.observe(page))
    return () => observer.disconnect()
  }, [mode, readScale])

  const goTo = target => {
    const i = Math.max(0, Math.min(slides.length - 1, target))
    setIndex(i)
    setNavOpen(false)
    if (mode === 'slides') stageRef.current?.goTo(i)
    else document.getElementById(`share-page-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    history.replaceState(null, '', `#${encodeURIComponent(slides[i]?.id ?? String(i + 1))}`)
  }

  const switchMode = next => {
    setMode(next)
    if (next === 'read') setTimeout(() => document.getElementById(`share-page-${index}`)?.scrollIntoView({ block: 'start' }), 50)
  }

  const copyLink = async () => {
    const url = new URL(location.href)
    url.searchParams.set('view', 'share')
    url.hash = encodeURIComponent(slides[index]?.id ?? String(index + 1))
    try { await navigator.clipboard.writeText(url.toString()); setToast('Link copied') } catch { setToast(url.toString()) }
    setTimeout(() => setToast(''), 1800)
  }

  const savePdf = () => {
    if (mode !== 'slides') switchMode('slides')
    setTimeout(() => window.print(), 150)
  }

  const meta = deckConfig.meta ?? {}
  const metaLine = [meta.author, meta.organization, meta.date].filter(Boolean).join(' · ')
  const senderLook = { design: THEME_METAS[deckConfig.design] ? deckConfig.design : 'neue', palette: PALETTES[deckConfig.palette] ? deckConfig.palette : '' }
  const isSenderLook = look.design === senderLook.design && (look.palette || '') === (senderLook.palette || '')

  return <div class="share">
    <header class="share-top">
      <button class="share-btn share-nav-toggle" onClick={() => setNavOpen(open => !open)} aria-label="Outline">☰</button>
      <h1>{meta.title ?? 'Slides'}</h1>
      {metaLine && <span class="share-meta">{metaLine}</span>}
      <span class="share-spacer" />
      <span class="share-count">{index + 1} / {slides.length}</span>
      <button class={`share-btn${mode === 'slides' ? ' is-active' : ''}`} onClick={() => switchMode('slides')}>Slides</button>
      <button class={`share-btn${mode === 'read' ? ' is-active' : ''}`} onClick={() => switchMode('read')}>Read</button>
      {pickerAllowed && <div class="share-menu">
        <button class={`share-btn${lookOpen ? ' is-active' : ''}`} onClick={() => setLookOpen(open => !open)}>Look ▾</button>
        {lookOpen && <div class="share-menu-panel">
          <label>Theme<select class="share-select" value={look.design} onChange={e => setLook({ ...look, design: e.currentTarget.value })}>{Object.values(THEME_METAS).map(theme => <option key={theme.id} value={theme.id}>{theme.title}</option>)}</select></label>
          <label>Colors<select class="share-select" value={look.palette} onChange={e => setLook({ ...look, palette: e.currentTarget.value })}><option value="">Theme colors</option>{Object.values(PALETTES).map(palette => <option key={palette.id} value={palette.id}>{palette.title}</option>)}</select></label>
          <button class="share-btn" disabled={isSenderLook} onClick={() => setLook(senderLook)} title={isSenderLook ? 'This is the look the deck was made with' : 'Return to the look the deck was made with'}>Reset to default</button>
        </div>}
      </div>}
      {pdf
        ? <a class="share-btn is-primary" href={pdf} download={`${(meta.title ?? 'slides').replace(/[^\w.-]+/g, '-')}.pdf`}>Download PDF</a>
        : <button class="share-btn is-primary" onClick={savePdf} title="Opens the browser's print dialog; choose Save as PDF">Save as PDF…</button>}
      <a class="share-btn" href={`?view=deck#${encodeURIComponent(slides[index]?.id ?? String(index + 1))}`}>Present</a>
    </header>
    <div class="share-main" onClick={() => lookOpen && setLookOpen(false)}>
      <nav class={`share-nav${navOpen ? ' is-open' : ''}`} aria-label="Slides">
        <ol>
          {outline.map(item => <li key={item.index} class={`${item.index === index ? 'is-current' : ''}${item.chapter ? ' is-chapter' : ''}`} onClick={() => goTo(item.index)}>
            <span class="share-num">{String(item.index + 1).padStart(2, '0')}</span>
            <span class="share-title">{item.chapter && item.part && <span class="share-part">{item.part}</span>}{item.title}</span>
          </li>)}
        </ol>
      </nav>
      <section class="share-content">
        {mode === 'slides'
          ? <>
            <div class="share-stage-wrap">
              <deck-stage ref={stageRef} width={width} height={height}>
                {slides.map((slide, i) => <SlideRenderer key={slide.id} id={slide.id} regions={slide.regions} meta={slide.meta} content={slide.content} deckConfig={deckConfig} index={i} total={slides.length} />)}
              </deck-stage>
            </div>
            <div class="share-bottom">
              <button class="share-btn" onClick={() => stageRef.current?.prev('click')}>← Previous</button>
              <button class="share-btn" onClick={() => stageRef.current?.next('click')}>Next →</button>
              <span class="share-spacer" />
              <button class="share-btn" onClick={copyLink}>Copy link to this slide</button>
            </div>
          </>
          : <div class="share-read" ref={readRef}>
            {slides.map((slide, i) => <ReadPage key={slide.id} slide={slide} index={i} total={slides.length} deckConfig={deckConfig} width={width} height={height} scale={readScale} showNotes={showNotes} />)}
          </div>}
      </section>
    </div>
    {toast && <div class="share-toast">{toast}</div>}
  </div>
}
