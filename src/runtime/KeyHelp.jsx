// The keys that work right now (helpKeys.js), over the slide in a
// semi-transparent layer: ? shows and hides it, Escape or a click closes it.
// The presenter view renders it itself; a deck window gets it from
// attachKeyHelp. While it is open the other keys keep working, and the list
// follows them (H, D, a slide with hotspots).
import { h, render } from 'preact'
import { useState, useEffect, useRef } from 'preact/hooks'
import { keyHelp, isHelpKey } from './helpKeys.js'
import { fullscreenAvailable } from './stage/fullscreen.js'

const typing = target => target?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]')
export const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '')

/** Open state for the help: ? toggles it, Escape closes it before anything else sees Escape. */
export function useKeyHelp() {
  const [open, setOpen] = useState(false)
  const openRef = useRef(false)
  openRef.current = open
  useEffect(() => {
    const onKey = event => {
      if (typing(event.target)) return
      if (isHelpKey(event)) {
        event.preventDefault()
        event.stopPropagation()
        setOpen(shown => !shown)
      } else if (event.key === 'Escape' && openRef.current) {
        event.preventDefault()
        event.stopPropagation()
        setOpen(false)
      }
    }
    // Capturing, so that Escape closes the help instead of zooming out or ending a drawing.
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])
  return [open, setOpen]
}

const S = {
  layer: { position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', boxSizing: 'border-box', background: 'rgba(8,8,8,0.45)', fontFamily: 'ui-sans-serif, system-ui, sans-serif', direction: 'ltr' },
  panel: { width: 'min(100%, 980px)', maxHeight: '100%', overflow: 'auto', boxSizing: 'border-box', padding: '22px 26px 24px', borderRadius: '14px', background: 'rgba(20,20,20,0.82)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 60px rgba(0,0,0,0.45)', color: '#e8e8e8' },
  head: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '16px', marginBottom: '16px' },
  heading: { margin: 0, fontSize: '16px', fontWeight: 600 },
  hint: { fontSize: '12px', color: '#8a8a8a' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: '20px 36px' },
  title: { margin: '0 0 8px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a8a8a' },
  // One grid per group, so its keys share a column as wide as the widest.
  list: { margin: 0, padding: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: 'auto 1fr', alignItems: 'baseline', gap: '8px 14px', fontSize: '13.5px', lineHeight: 1.35 },
  row: { display: 'contents' },
  keys: { display: 'flex', flexWrap: 'wrap', gap: '4px' },
  kbd: { display: 'inline-block', minWidth: '14px', padding: '1px 6px', borderRadius: '5px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.16)', borderBottomWidth: '2px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '12px', color: '#f4f4f4', textAlign: 'center', whiteSpace: 'nowrap' },
}

/** The layer itself: `context` is what keyHelp() takes. */
export function KeyHelp({ context, onClose }) {
  const groups = keyHelp({ mac: isMac(), ...context })
  return (
    <div class="key-help" role="dialog" aria-label="Keyboard shortcuts" style={S.layer} onClick={onClose}>
      <div style={S.panel} onClick={event => event.stopPropagation()}>
        <div style={S.head}>
          <h2 style={S.heading}>Keys</h2>
          <span style={S.hint}>The keys that work now · ? or Esc closes</span>
        </div>
        <div style={S.grid}>
          {groups.map(group => (
            <section key={group.title} class="key-help-group">
              <h3 style={S.title}>{group.title}</h3>
              <ul style={S.list}>
                {group.keys.map(({ keys, label }) => (
                  <li key={label} style={S.row}>
                    <span style={S.keys}>{keys.map(key => <kbd key={key} style={S.kbd}>{key}</kbd>)}</span>
                    <span>{label}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

// A deck window's help: what it lists follows the stage (the slide's
// hotspots, drawing on or off).
function DeckKeyHelp({ stage, canDraw }) {
  const [open, setOpen] = useKeyHelp()
  const [, refresh] = useState(0)
  useEffect(() => {
    const update = () => refresh(n => n + 1)
    const events = ['slidechange', 'statechange', 'inkmode', 'overviewchange']
    for (const name of events) stage.addEventListener(name, update)
    return () => { for (const name of events) stage.removeEventListener(name, update) }
  }, [stage])
  if (!open) return null
  const context = {
    view: 'deck',
    blank: stage.blank,
    join: stage.hasAttribute('data-joinable'),
    joinShown: stage.join,
    overview: stage.overview,
    hotspots: stage.hotspotMode !== 'off',
    inking: stage.inking,
    canDraw,
    fullscreen: window.top === window && fullscreenAvailable(),
  }
  return <KeyHelp context={context} onClose={() => setOpen(false)} />
}

/** Gives a deck window the help that ? shows. */
export function attachKeyHelp(stage, { canDraw = true } = {}) {
  const host = document.createElement('div')
  host.className = 'key-help-host'
  document.body.appendChild(host)
  render(h(DeckKeyHelp, { stage, canDraw }), host)
}
