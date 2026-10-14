import { h } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import QrCodeTag from '../components/QrCodeTag.jsx'
import { t } from '../core/labels.js'

// The join code over the slide (J in the presenter view): the room scans it
// from the projector, a phone following the talk shows it too. A click on it,
// or the next step, hides it again where the screen is not only watching.
export function JoinOverlay({ stage }) {
  const [on, setOn] = useState(stage.join)
  useEffect(() => {
    const follow = () => setOn(stage.join)
    stage.addEventListener('joinchange', follow)
    return () => stage.removeEventListener('joinchange', follow)
  }, [])
  if (!on) return null
  const size = Math.round(Math.min(window.innerHeight * 0.55, window.innerWidth * 0.5, 520))
  return <div class="join-overlay export-hidden" role="dialog" aria-label={t('join.scan')}
    onClick={() => { if (!stage.hasAttribute('data-watching')) stage.setJoin(false, 'click') }}
    style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.72)' }}>
    <div style={{ background: '#fff', color: '#111', borderRadius: '18px', padding: '24px 32px', '--qr-ink': '#000', '--qr-bg': '#fff', '--ink': '#111', '--muted': '#555' }}>
      <QrCodeTag join size={String(size)} />
    </div>
  </div>
}
