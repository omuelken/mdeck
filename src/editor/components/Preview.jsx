import { h } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'

const PREVIEW_URL = '/?editor=1&embedded=1'

// Hosts the deck runtime in editor mode and keeps it fed with the current
// source. Navigation inside the preview reports back so the outline follows.
export function Preview({ source, selection, config = null, overrides = null, reloadKey = 0, width, height, onState, onRendered }) {
  const frame = useRef(null)
  const [ready, setReady] = useState(false)
  const reported = useRef(null)
  const post = message => frame.current?.contentWindow?.postMessage(message, location.origin)

  useEffect(() => {
    const onMessage = event => {
      if (event.source !== frame.current?.contentWindow || event.origin !== location.origin) return
      const data = event.data ?? {}
      if (data.deckEditorReady) setReady(true)
      if (data.deckRendered) onRendered(data.deckRendered)
      if (data.deckStateChanged) {
        reported.current = data.deckStateChanged.index
        if (!['init', 'sync'].includes(data.reason)) onState(data.deckStateChanged.index)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // Coalesce bursts of keystrokes into one push per tick. A timer rather than
  // requestAnimationFrame, which stalls in background tabs.
  const overridesKey = JSON.stringify({ config, overrides })
  useEffect(() => {
    if (!ready) return
    const id = setTimeout(() => post({ deckSource: { source, selection, config, overrides } }), 0)
    return () => clearTimeout(id)
  }, [ready, source, overridesKey])

  // Template layouts are code inside the preview's module graph: after they
  // change on disk the frame reloads and reports ready again.
  useEffect(() => { if (reloadKey && frame.current) { setReady(false); frame.current.contentWindow?.location.reload() } }, [reloadKey])

  useEffect(() => {
    if (ready && reported.current !== selection.index) post({ deckControl: { command: 'setState', value: { index: selection.index, slideId: selection.slideId, step: -1 } } })
  }, [ready, selection.index])

  const control = command => post({ deckControl: { command } })
  return <section class="preview" data-ready={String(ready)}>
    <div class="preview-frame">
      {/* The runtime's listener exists once the frame has loaded; its own ready
          message may arrive before this component listens, so both count. */}
      <iframe ref={frame} title="Slide preview" src={PREVIEW_URL} onLoad={() => setReady(true)} style={{ aspectRatio: `${width} / ${height}` }} />
    </div>
    <div class="preview-tools">
      <button class="btn is-small" onClick={() => control('prev')}>← Previous</button>
      <button class="btn is-small" onClick={() => control('next')}>Next →</button>
      <button class="btn is-small" onClick={() => control('reset')}>Reset</button>
      <span class="spacer" />
      <span>Slide {selection.index + 1}</span>
    </div>
  </section>
}
