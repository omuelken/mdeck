import { h, render } from 'preact'
import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { marked } from 'marked'
import slidesContent from 'virtual:slides'
import { parseSlides } from './parseSlides'
import { loadTheme, THEME_NAMES, PALETTE_NAMES, THEME_METAS, PALETTES } from './themeLoader'
import { SlideRenderer } from './renderSlide'
import './markedSetup'
import './deck-stage.js'

const DECK_CHANNEL = 'deck-control'

function withConfigOverrides(deckConfig) {
  const url = new URL(window.location.href)
  const design = url.searchParams.get('design')
  const palette = url.searchParams.get('palette')
  const accent  = url.searchParams.get('accent')
  const accent2 = url.searchParams.get('accent2')
  return {
    ...deckConfig,
    // Use !== null so an explicit ?palette= / ?accent= (empty string) overrides the frontmatter value
    ...(design  !== null ? { design }  : {}),
    ...(palette !== null ? { palette } : {}),
    ...(accent  !== null ? { accent }  : {}),
    ...(accent2 !== null ? { accent2 } : {}),
  }
}

function injectSpeakerNotes(slides) {
  let tag = document.getElementById('speaker-notes')
  if (!tag) {
    tag = document.createElement('script')
    tag.id = 'speaker-notes'
    tag.type = 'application/json'
    document.body.appendChild(tag)
  }
  tag.textContent = JSON.stringify(slides.map(s => s.meta?.notes ?? s.meta?.note ?? ''))
}

// URL for the presenter's own iframe and preview pane (uses postMessage)
function buildChildUrl(design, palette, accent, accent2, slideIndex = null) {
  const url = new URL(window.location.href)
  url.searchParams.delete('presenter')
  url.searchParams.delete('audience')
  url.searchParams.set('embedded', '1')
  if (design) url.searchParams.set('design', design)
  else url.searchParams.delete('design')
  // Always set these params so an explicit "none" selection overrides the deck's frontmatter
  url.searchParams.set('palette', palette ?? '')
  url.searchParams.set('accent', accent ?? '')
  url.searchParams.set('accent2', accent2 ?? '')
  if (slideIndex != null) url.hash = String(slideIndex + 1)
  return url.toString()
}

// URL for the audience window — ?audience=1 makes it listen on BroadcastChannel
function buildAudienceUrl(design, palette, accent, accent2, slideIndex = null) {
  const url = new URL(window.location.href)
  url.searchParams.delete('presenter')
  url.searchParams.delete('embedded')
  url.searchParams.set('audience', '1')
  if (design) url.searchParams.set('design', design)
  else url.searchParams.delete('design')
  url.searchParams.set('palette', palette ?? '')
  url.searchParams.set('accent', accent ?? '')
  url.searchParams.set('accent2', accent2 ?? '')
  if (slideIndex != null) url.hash = String(slideIndex + 1)
  return url.toString()
}

function sendTo(win, command, value) {
  if (!win || win.closed) return
  win.postMessage({ deckControl: { command, value } }, '*')
}

const S = {
  btn: {
    appearance: 'none',
    WebkitAppearance: 'none',
    padding: '5px 12px',
    borderRadius: '5px',
    border: '1px solid #2e2e2e',
    background: '#1e1e1e',
    color: '#999',
    cursor: 'pointer',
    fontSize: '13px',
    fontFamily: 'inherit',
    lineHeight: '1.5',
    outline: 'none',
  },
  select: {
    padding: '5px 8px',
    borderRadius: '5px',
    border: '1px solid #2e2e2e',
    background: '#1e1e1e',
    color: '#999',
    cursor: 'pointer',
    fontSize: '13px',
    fontFamily: 'inherit',
    width: '100%',
  },
  label: {
    color: '#555',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: '5px',
    display: 'block',
  },
}

function PaletteSwatches({ tokens }) {
  const keys = ['--bg', '--surface', '--rule', '--accent', '--accent-2', '--ink']
  return (
    <div style={{ display: 'flex', gap: '2px', alignItems: 'center', flexShrink: 0 }}>
      {keys.map(k => tokens[k]
        ? <div key={k} style={{ width: '10px', height: '10px', borderRadius: '2px', background: tokens[k], border: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }} />
        : null
      )}
    </div>
  )
}

function themeParamDefault(themeMeta, token) {
  if (!themeMeta?.params) return null
  for (const param of Object.values(themeMeta.params)) {
    if (param.token === token) return param.default
  }
  return null
}

function PresenterView({ deckConfig, slides }) {
  const [index, setIndex] = useState(0)
  const [design, setDesign] = useState(deckConfig.design ?? 'neue')
  const [palette, setPalette] = useState(PALETTE_NAMES.includes(deckConfig.palette) ? deckConfig.palette : '')
  const [accent, setAccent] = useState(deckConfig.accent ?? '')
  const [accent2, setAccent2] = useState(deckConfig.accent2 ?? '')
  const [audienceConnected, setAudienceConnected] = useState(false)
  const [noteSize, setNoteSize] = useState(13)

  const [paletteOpen, setPaletteOpen] = useState(false)
  const [designOpen, setDesignOpen] = useState(false)

  const iframeRef = useRef(null)
  const previewRef = useRef(null)
  const audienceRef = useRef(null)
  const bcRef = useRef(null)
  const indexRef = useRef(0)
  const paletteDropRef = useRef(null)
  indexRef.current = index

  const usesAccent2 = THEME_METAS[design]?.usesAccent2 ?? false
  const themeMeta = THEME_METAS[design]
  const paletteTokens = PALETTES[palette]?.tokens ?? {}
  const effectiveAccent  = accent  || paletteTokens['--accent']   || themeParamDefault(themeMeta, '--accent')   || '#888888'
  const effectiveAccent2 = accent2 || paletteTokens['--accent-2'] || themeMeta?.defaultAccent2 || themeParamDefault(themeMeta, '--accent-2') || '#888888'
  const notes = useMemo(() => slides.map(s => s.meta?.notes ?? s.meta?.note ?? ''), [slides])
  // Preserve current slide when design/palette causes an iframe reload
  const iframeSrc = useMemo(() => buildChildUrl(design, palette, accent, accent2, indexRef.current), [design, palette, accent, accent2])
  // previewSrc only recomputes on design/palette/accent change; slide changes use postMessage
  const previewSrc = useMemo(
    () => buildChildUrl(design, palette, accent, accent2, indexRef.current + 1),
    [design, palette, accent, accent2]
  )

  // BroadcastChannel for audience sync — more reliable than cross-window postMessage
  useEffect(() => {
    bcRef.current = new BroadcastChannel(DECK_CHANNEL)
    return () => bcRef.current?.close()
  }, [])

  // When the presenter iframe navigates: update displayed index, sync audience + preview
  useEffect(() => {
    function onMessage({ data, source }) {
      if (source !== iframeRef.current?.contentWindow) return
      if (!data || typeof data.slideIndexChanged !== 'number') return
      const i = data.slideIndexChanged
      setIndex(i)
      bcRef.current?.postMessage({ deckControl: { command: 'goTo', value: i } })
      sendTo(previewRef.current?.contentWindow, 'goTo', i + 1)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // Keyboard nav in the presenter sidebar → drive the iframe only;
  // audience follows automatically via the slideIndexChanged → BroadcastChannel path
  useEffect(() => {
    function onKey(e) {
      if (e.target?.matches?.('input, select, textarea')) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const cmd =
        (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') ? 'next' :
        (e.key === 'ArrowLeft'  || e.key === 'PageUp')                    ? 'prev' :
        (e.key === 'Home' || e.key === 'r' || e.key === 'R')              ? 'reset' : null
      if (!cmd) return
      e.preventDefault()
      sendTo(iframeRef.current?.contentWindow, cmd)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Close palette dropdown on outside click
  useEffect(() => {
    if (!paletteOpen) return
    function handler(e) {
      if (!paletteDropRef.current?.contains(e.target)) setPaletteOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [paletteOpen])

  // When design/palette changes, tell the audience to hot-swap its theme without a reload
  useEffect(() => {
    bcRef.current?.postMessage({ deckControl: { command: 'setTheme', design, palette, accent, accent2 } })
  }, [design, palette, accent, accent2])

  // Nav buttons drive the presenter iframe; audience follows via slideIndexChanged
  function navCommand(cmd) {
    sendTo(iframeRef.current?.contentWindow, cmd)
  }

  function openAudienceWindow() {
    const aw = window.open(
      buildAudienceUrl(design, palette, accent, accent2, indexRef.current),
      'deck-audience-view'
    )
    if (!aw) return
    audienceRef.current = aw
    setAudienceConnected(true)
  }

  const note = notes[index] || ''
  const hasNext = index + 1 < slides.length

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', height: '100vh', background: '#111', overflow: 'hidden' }}>
      <iframe
        ref={iframeRef}
        title="Presenter deck"
        src={iframeSrc}
        style={{ width: '100%', height: '100%', border: '0' }}
      />
      <aside style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        padding: '16px',
        borderLeft: '1px solid #2a2a2a',
        background: '#111',
        color: '#ccc',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        fontSize: '13px',
        overflow: 'hidden',
      }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontWeight: 600, color: '#f0f0f0', fontSize: '14px' }}>Speaker View</span>
          <span style={{ color: '#666', fontVariantNumeric: 'tabular-nums' }}>
            {String(index + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
          </span>
        </div>

        {hasNext && (
          <div style={{ flexShrink: 0 }}>
            <span style={S.label}>Next slide</span>
            <div style={{ aspectRatio: '16/9', borderRadius: '4px', overflow: 'hidden', border: '1px solid #2a2a2a', background: '#000' }}>
              <iframe
                ref={previewRef}
                title="Next slide preview"
                src={previewSrc}
                scrolling="no"
                style={{ width: '100%', height: '100%', border: '0', pointerEvents: 'none' }}
              />
            </div>
          </div>
        )}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
            <span style={{ ...S.label, marginBottom: 0 }}>Notes</span>
            <div style={{ display: 'flex', gap: '3px' }}>
              <button style={{ ...S.btn, padding: '1px 7px', fontSize: '14px' }} onClick={() => setNoteSize(s => Math.max(9, s - 1))}>−</button>
              <button style={{ ...S.btn, padding: '1px 7px', fontSize: '14px' }} onClick={() => setNoteSize(s => Math.min(24, s + 1))}>+</button>
            </div>
          </div>
          <div class="notes-md" style={{
            flex: 1,
            margin: 0,
            padding: '10px 12px',
            lineHeight: 1.6,
            background: '#0a0a0a',
            border: '1px solid #2a2a2a',
            borderRadius: '5px',
            fontSize: `${noteSize}px`,
            color: note ? '#c8c8c8' : '#3a3a3a',
            fontFamily: 'inherit',
            overflow: 'auto',
          }}
            dangerouslySetInnerHTML={{
              __html: note
                ? marked.parse(note)
                : '<p>No notes — add <code>note:</code> in the slide frontmatter.</p>',
            }}
          />
        </div>

        <div style={{ flexShrink: 0 }}>
          <button
            onClick={() => setDesignOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', padding: '2px 0 6px', cursor: 'pointer', color: '#555', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', width: '100%' }}
          >
            <span style={{ fontSize: '8px', opacity: 0.7 }}>{designOpen ? '▼' : '▶'}</span>
            Theme & Palette
          </button>
          {designOpen && (
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              <label style={{ flex: 1 }}>
                <span style={S.label}>Theme</span>
                <select value={design} onChange={e => { setDesign(e.currentTarget.value); setAccent2('') }} style={S.select}>
                  {THEME_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label style={{ flex: 1 }}>
                <span style={S.label}>Palette</span>
                <div ref={paletteDropRef} style={{ position: 'relative' }}>
                  <button
                    onClick={() => setPaletteOpen(o => !o)}
                    style={{ ...S.select, display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{palette || 'none'}</span>
                    {palette && <PaletteSwatches tokens={PALETTES[palette]?.tokens ?? {}} />}
                    <span style={{ opacity: 0.35, fontSize: '8px', flexShrink: 0 }}>▼</span>
                  </button>
                  {paletteOpen && (
                    <div style={{ position: 'absolute', bottom: 'calc(100% + 4px)', left: 0, right: 0, background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '5px', zIndex: 100, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.6)' }}>
                      <div
                        onClick={() => { setPalette(''); setAccent(''); setPaletteOpen(false) }}
                        style={{ padding: '6px 8px', cursor: 'pointer', fontSize: '13px', color: palette ? '#555' : '#ccc' }}
                      >
                        none
                      </div>
                      {PALETTE_NAMES.map(n => (
                        <div
                          key={n}
                          onClick={() => { setPalette(n); setAccent(''); setPaletteOpen(false) }}
                          style={{ padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', fontSize: '13px', color: palette === n ? '#f0f0f0' : '#aaa', background: palette === n ? '#2a2a2a' : 'transparent' }}
                        >
                          <span>{n}</span>
                          <PaletteSwatches tokens={PALETTES[n]?.tokens ?? {}} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </label>
              <label style={{ flexShrink: 0 }}>
                <span style={S.label}>Accent</span>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', height: '28px' }}>
                  <input
                    type="color"
                    value={effectiveAccent}
                    onInput={e => setAccent(e.currentTarget.value)}
                    style={{ width: '28px', height: '28px', padding: '2px', border: '1px solid #2e2e2e', borderRadius: '5px', background: '#1e1e1e', cursor: 'pointer', opacity: accent ? 1 : 0.6 }}
                  />
                  {accent && (
                    <button onClick={() => setAccent('')} style={{ ...S.btn, padding: '3px 7px', fontSize: '14px', lineHeight: 1 }}>×</button>
                  )}
                </div>
              </label>
              {usesAccent2 && (
                <label style={{ flexShrink: 0 }}>
                  <span style={S.label}>Accent 2</span>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', height: '28px' }}>
                    <input
                      type="color"
                      value={effectiveAccent2}
                      onInput={e => setAccent2(e.currentTarget.value)}
                      style={{ width: '28px', height: '28px', padding: '2px', border: '1px solid #2e2e2e', borderRadius: '5px', background: '#1e1e1e', cursor: 'pointer', opacity: accent2 ? 1 : 0.6 }}
                    />
                    {accent2 && (
                      <button onClick={() => setAccent2('')} style={{ ...S.btn, padding: '3px 7px', fontSize: '14px', lineHeight: 1 }}>×</button>
                    )}
                  </div>
                </label>
              )}
            </div>
          )}
        </div>

        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button style={S.btn} onClick={() => navCommand('prev')}>← Prev</button>
            <button style={S.btn} onClick={() => navCommand('next')}>Next →</button>
            <button style={S.btn} onClick={() => navCommand('reset')}>Reset</button>
            <button
              style={{
                ...S.btn,
                marginLeft: 'auto',
                color: audienceConnected ? '#444' : '#bbb',
              }}
              onClick={openAudienceWindow}
            >
              {audienceConnected ? 'Reconnect' : 'Audience'}
            </button>
          </div>
          <div style={{ color: '#444', fontSize: '11px', textAlign: 'center' }}>
            Arrow keys · Space · PgUp/PgDn · R to reset
          </div>
        </div>

      </aside>
    </div>
  )
}

async function init() {
  const parsed = parseSlides(slidesContent)
  const deckConfig = withConfigOverrides(parsed.deckConfig)
  const { slides } = parsed
  const url = new URL(window.location.href)
  const presenterMode = url.searchParams.get('presenter') === '1'
  const audienceMode  = url.searchParams.get('audience')  === '1'

  injectSpeakerNotes(slides)

  if (presenterMode) {
    document.body.style.margin = '0'
    const s = document.createElement('style')
    s.textContent = `
      .notes-md p { margin: 0 0 6px; }
      .notes-md p:last-child { margin-bottom: 0; }
      .notes-md ul, .notes-md ol { margin: 0 0 6px; padding-left: 1.4em; }
      .notes-md li { margin-bottom: 2px; }
      .notes-md strong, .notes-md b { color: #f0f0f0; font-weight: 600; }
      .notes-md em, .notes-md i { font-style: italic; color: #bbb; }
      .notes-md code { font-family: ui-monospace, monospace; font-size: 0.9em; background: #222; padding: 1px 4px; border-radius: 3px; }
      .notes-md a { color: #aaa; }
    `
    document.head.appendChild(s)
    render(<PresenterView deckConfig={deckConfig} slides={slides} />, document.body)
    return
  }

  await loadTheme(deckConfig)

  const app = (
    <deck-stage width={deckConfig.width ?? 1920} height={deckConfig.height ?? 1080}>
      {slides.map((slide, i) => (
        <SlideRenderer
          key={i}
          meta={slide.meta}
          content={slide.content}
          deckConfig={deckConfig}
          index={i}
          total={slides.length}
        />
      ))}
    </deck-stage>
  )

  render(app, document.body)

  function handleDeckControl(ctrl) {
    if (!ctrl) return
    const stage = document.querySelector('deck-stage')
    if (!stage) return
    if (ctrl.command === 'next') stage.next()
    else if (ctrl.command === 'prev') stage.prev()
    else if (ctrl.command === 'reset') stage.reset()
    else if (ctrl.command === 'goTo' && Number.isInteger(ctrl.value)) stage.goTo(ctrl.value)
  }

  // Embedded iframes (presenter view + preview pane) receive commands via postMessage
  window.addEventListener('message', event => handleDeckControl(event.data?.deckControl))

  // Audience window receives commands via BroadcastChannel — reliable same-origin sync
  // that doesn't depend on keeping a live cross-window reference
  if (audienceMode) {
    const bc = new BroadcastChannel(DECK_CHANNEL)
    bc.onmessage = ({ data }) => {
      const ctrl = data?.deckControl
      if (!ctrl) return
      if (ctrl.command === 'setTheme') {
        loadTheme({ design: ctrl.design, palette: ctrl.palette, accent: ctrl.accent, accent2: ctrl.accent2 })
      } else {
        handleDeckControl(ctrl)
      }
    }
  }
}

init()
