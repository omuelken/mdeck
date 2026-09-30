import { h } from 'preact'
import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { marked } from 'marked'
import { deckOutline } from '../core/outline.js'
import { manifests, SlideRenderer } from '../templates/renderSlide'
import { loadTheme, THEME_METAS, PALETTES } from './themeLoader'
import './share.css'
import { t, stageLabels } from '../core/labels.js'

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

// Small line icons; every button carries one so the bar reads at a glance.
const ICONS = {
  menu: 'M4 7h16M4 12h16M4 17h16',
  slides: 'M3 5h18v12H3zM8 21h8',
  read: 'M4 4h16v16H4zM8 9h8M8 13h8M8 17h5',
  look: 'M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-2 0-3 3 0 4-1 2-3 2-3a9 9 0 0 0-8-9zM7.5 11a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM11 7.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM16 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  download: 'M12 4v11m0 0l-4-4m4 4l4-4M5 19h14',
  present: 'M4 4h16v12H4zM12 16v4M8 20h8M9 7l5 3-5 3z',
  prev: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5',
  reset: 'M4 12a8 8 0 1 0 2.3-5.7L4 8.5M4 4v4.5h4.5',
}
function Icon({ name }) {
  return <svg class="share-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={ICONS[name]} /></svg>
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
  const outline = useMemo(() => deckOutline(deck, manifests, { slideName: n => t('reader.slide', { n }) }), [deck])
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
    stage.setLabels(stageLabels())
    stage.addEventListener('slidechange', onChange)
    return () => stage.removeEventListener('slidechange', onChange)
  }, [mode])

  // Read mode shows every slide finished: all steps revealed, as in print.
  useEffect(() => {
    if (mode !== 'read' || !readRef.current) return
    readRef.current.querySelectorAll('[data-step]').forEach(step => step.setAttribute('data-step-visible', ''))
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
    url.searchParams.delete('view')
    url.searchParams.set('v', 's')
    url.hash = encodeURIComponent(slides[index]?.id ?? String(index + 1))
    try { await navigator.clipboard.writeText(url.toString()); setToast(t('reader.linkCopied')) } catch { setToast(url.toString()) }
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
      <button class="share-btn share-nav-toggle" onClick={() => setNavOpen(open => !open)} aria-label={t('reader.outline')}><Icon name="menu" /></button>
      <h1>{meta.title ?? t('reader.untitled')}</h1>
      {metaLine && <span class="share-meta">{metaLine}</span>}
      <span class="share-spacer" />
      <span class="share-count">{index + 1} / {slides.length}</span>
      <button class={`share-btn${mode === 'slides' ? ' is-active' : ''}`} onClick={() => switchMode('slides')}><Icon name="slides" />{t('reader.slides')}</button>
      <button class={`share-btn${mode === 'read' ? ' is-active' : ''}`} onClick={() => switchMode('read')}><Icon name="read" />{t('reader.read')}</button>
      {pickerAllowed && <div class="share-menu">
        <button class={`share-btn${lookOpen ? ' is-active' : ''}`} onClick={() => setLookOpen(open => !open)}><Icon name="look" />{t('reader.look')}</button>
        {lookOpen && <div class="share-menu-panel">
          <label>{t('reader.theme')}<select class="share-select" value={look.design} onChange={e => setLook({ ...look, design: e.currentTarget.value })}>{Object.values(THEME_METAS).map(theme => <option key={theme.id} value={theme.id}>{theme.title}</option>)}</select></label>
          <label>{t('reader.colors')}<select class="share-select" value={look.palette} onChange={e => setLook({ ...look, palette: e.currentTarget.value })}><option value="">{t('reader.themeColors')}</option>{Object.values(PALETTES).map(palette => <option key={palette.id} value={palette.id}>{palette.title}</option>)}</select></label>
          <button class="share-btn" disabled={isSenderLook} onClick={() => setLook(senderLook)} title={isSenderLook ? t('reader.senderLook') : t('reader.resetLookHint')}><Icon name="reset" />{t('reader.resetLook')}</button>
        </div>}
      </div>}
      {pdf
        ? <a class="share-btn" href={pdf} download={`${(meta.title ?? 'slides').replace(/[^\w.-]+/g, '-')}.pdf`}><Icon name="download" />{t('reader.downloadPdf')}</a>
        : <button class="share-btn" onClick={savePdf} title={t('reader.savePdfHint')}><Icon name="download" />{t('reader.savePdf')}</button>}
      <a class="share-btn" href={`?view=deck#${encodeURIComponent(slides[index]?.id ?? String(index + 1))}`}><Icon name="present" />{t('reader.present')}</a>
    </header>
    <div class="share-main" onClick={() => lookOpen && setLookOpen(false)}>
      <nav class={`share-nav${navOpen ? ' is-open' : ''}`} aria-label={t('reader.slides')}>
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
              <button class="share-btn" onClick={() => stageRef.current?.prev('click')}><Icon name="prev" />{t('reader.previous')}</button>
              <button class="share-btn" onClick={() => stageRef.current?.next('click')}>{t('reader.next')}<Icon name="next" /></button>
              <span class="share-spacer" />
              <button class="share-btn" onClick={copyLink}><Icon name="link" />{t('reader.copyLink')}</button>
            </div>
          </>
          : <div class="share-read" ref={readRef} data-deck-static>
            {slides.map((slide, i) => <ReadPage key={slide.id} slide={slide} index={i} total={slides.length} deckConfig={deckConfig} width={width} height={height} scale={readScale} showNotes={showNotes} />)}
          </div>}
      </section>
    </div>
    {toast && <div class="share-toast">{toast}</div>}
  </div>
}
