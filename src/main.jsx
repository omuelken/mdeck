import { h, render } from 'preact'
import { useEffect, useMemo, useState } from 'preact/hooks'
import slidesContent from 'virtual:slides'
import { parseSlides } from './parseSlides'
import { loadTheme, THEME_NAMES, PALETTE_NAMES } from './themeLoader'
import { SlideRenderer } from './renderSlide'
import './markedSetup'
import './deck-stage.js'

function withConfigOverrides(deckConfig) {
  const url = new URL(window.location.href)
  const design = url.searchParams.get('design')
  const palette = url.searchParams.get('palette')
  return {
    ...deckConfig,
    ...(design ? { design } : {}),
    ...(palette ? { palette } : {}),
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
  const notes = slides.map(slide => slide.meta?.notes ?? slide.meta?.note ?? '')
  tag.textContent = JSON.stringify(notes)
}

function buildChildUrl(design, palette) {
  const url = new URL(window.location.href)
  url.searchParams.delete('presenter')
  url.searchParams.set('embedded', '1')
  if (design) url.searchParams.set('design', design)
  else url.searchParams.delete('design')
  if (palette) url.searchParams.set('palette', palette)
  else url.searchParams.delete('palette')
  return url.toString()
}

function PresenterView({ deckConfig, slides }) {
  const [index, setIndex] = useState(0)
  const [design, setDesign] = useState(deckConfig.design ?? 'modern')
  const [palette, setPalette] = useState(deckConfig.palette ?? '')

  const notes = useMemo(() => slides.map(slide => slide.meta?.notes ?? slide.meta?.note ?? ''), [slides])
  const iframeSrc = useMemo(() => buildChildUrl(design, palette), [design, palette])

  useEffect(() => {
    function onMessage(event) {
      const data = event.data
      if (!data || typeof data.slideIndexChanged !== 'number') return
      setIndex(data.slideIndexChanged)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', height: '100vh', background: '#0f172a' }}>
      <iframe
        title="Presenter deck"
        src={iframeSrc}
        style={{ width: '100%', height: '100%', border: '0', background: '#000' }}
      />
      <aside style={{ color: '#e2e8f0', padding: '20px', fontFamily: 'ui-sans-serif, system-ui, sans-serif', overflow: 'auto' }}>
        <h2 style={{ margin: '0 0 12px 0' }}>Speaker View</h2>
        <div style={{ display: 'grid', gap: '12px', marginBottom: '18px' }}>
          <label style={{ display: 'grid', gap: '6px' }}>
            <span>Theme</span>
            <select value={design} onChange={e => setDesign(e.currentTarget.value)}>
              {THEME_NAMES.map(name => <option value={name}>{name}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: '6px' }}>
            <span>Palette</span>
            <select value={palette} onChange={e => setPalette(e.currentTarget.value)}>
              <option value="">(theme default)</option>
              {PALETTE_NAMES.map(name => <option value={name}>{name}</option>)}
            </select>
          </label>
        </div>
        <div style={{ opacity: 0.8, marginBottom: '10px' }}>Slide {index + 1} / {slides.length}</div>
        <pre style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5, background: '#111827', border: '1px solid #334155', borderRadius: '8px', padding: '12px' }}>
          {notes[index] || '(no speaker notes for this slide)'}
        </pre>
        <p style={{ opacity: 0.7, marginTop: '16px', fontSize: '14px' }}>
          Add notes with <code>note:</code> or <code>notes:</code> in each slide frontmatter.
        </p>
      </aside>
    </div>
  )
}

async function init() {
  const parsed = parseSlides(slidesContent)
  const deckConfig = withConfigOverrides(parsed.deckConfig)
  const { slides } = parsed
  const presenterMode = new URL(window.location.href).searchParams.get('presenter') === '1'

  injectSpeakerNotes(slides)

  if (presenterMode) {
    document.body.style.margin = '0'
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
}

init()
