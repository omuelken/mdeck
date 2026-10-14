// The theme picker, from the settings: every theme, showing the slide shown.
import { h } from 'preact'
import { useEffect } from 'preact/hooks'
import { THEME_NAMES } from '../themeLoader'
import { S } from '../chrome.jsx'
import { buildChildUrl } from './frameUrls.js'

export function ThemePicker({ theme, palette, appearance, index, onPick, onClose }) {
  // Escape closes it.
  useEffect(() => {
    function handler(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '24px', width: 'min(90vw, 1000px)', maxHeight: '85vh', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}
        onClick={e => e.stopPropagation()}
      >
        <span style={S.label}>Choose Theme</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
          {THEME_NAMES.map(n => (
            <div
              key={n}
              onClick={() => { onPick(n); onClose() }}
              style={{ cursor: 'pointer', borderRadius: '8px', overflow: 'hidden', border: `2px solid ${n === theme ? '#60a5fa' : '#2a2a2a'}`, background: '#111' }}
            >
              <div style={{ aspectRatio: '16/9', overflow: 'hidden' }}>
                <iframe
                  src={buildChildUrl(n, palette, appearance, index)}
                  scrolling="no"
                  style={{ width: '100%', height: '100%', border: 0, pointerEvents: 'none', display: 'block' }}
                />
              </div>
              <div style={{ padding: '8px 10px', fontSize: '14px', fontFamily: 'inherit', color: n === theme ? '#f0f0f0' : '#aaa', background: n === theme ? '#1c2a3a' : 'transparent' }}>
                {n}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
