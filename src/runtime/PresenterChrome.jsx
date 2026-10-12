// The presenter view's controls, shared by its three layouts (main.jsx): the
// speaker layout on a computer, the slide alone on an iPad, and the phone
// clicker. What is used during the talk is an icon button, its key in the
// tooltip; what is set once lives in two popovers: who is connected (with
// the codes that pair an iPad or a phone) and the settings.
import { h } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { S } from './chrome.jsx'
import { Icon } from '../components/Icon.jsx'
import QrCode from '../components/QrCode.jsx'
import { ConnectedViews } from '../components/ConnectedViews.jsx'
import { devicesText, phonesText } from '../live/presence.js'
import { devPath } from '../core/devPath.js'

export const tool = { ...S.btn, minWidth: '40px', height: '40px', padding: '0 10px', borderRadius: '10px', fontSize: '15px' }
export const toolOn = { background: '#f0f0f0', borderColor: '#f0f0f0', color: '#111' }
const muted = { color: '#888', fontSize: '12px' }

/** An icon button; `label` is its tooltip and name, with the key in brackets. */
export function ToolButton({ icon, label, pressed, onClick, class: className, style, size = 18, disabled, children }) {
  return <button type="button" class={className} title={label} aria-label={label} aria-pressed={pressed} disabled={disabled} onClick={onClick}
    style={{ ...tool, ...(pressed ? toolOn : {}), ...(disabled ? { opacity: 0.4, cursor: 'default' } : {}), ...style }}>
    {icon && <Icon name={icon} size={size} style={{ display: 'block' }} />}{children}
  </button>
}

/**
 * A button that opens a panel below (or above) it. The panel stays in the
 * page while closed, hidden, so its controls keep their state.
 */
export function Popover({ class: className, label, trigger, alert = false, above = false, align = 'end', children }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const outside = event => { if (!ref.current?.contains(event.target)) setOpen(false) }
    const escape = event => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', outside)
    window.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('keydown', escape) }
  }, [open])
  return <span ref={ref} class={className} style={{ position: 'relative', display: 'inline-flex' }}>
    <button type="button" class={`${className}-toggle`} title={label} aria-label={label} aria-expanded={open} onClick={() => setOpen(now => !now)}
      style={{ ...tool, position: 'relative', gap: '8px', ...(open ? { background: '#2a2a2a', color: '#fff' } : {}) }}>
      {trigger}
      {alert && <span aria-hidden="true" style={{ position: 'absolute', top: '5px', right: '5px', width: '8px', height: '8px', borderRadius: '50%', background: '#f28b82' }} />}
    </button>
    <div class={`${className}-panel`} role="dialog" aria-label={label} style={{
      display: open ? 'flex' : 'none', flexDirection: 'column', gap: '14px', position: 'absolute', zIndex: 300,
      [above ? 'bottom' : 'top']: 'calc(100% + 6px)', [align === 'end' ? 'right' : 'left']: 0,
      width: 'min(340px, calc(100vw - 24px))', maxHeight: 'min(80dvh, 640px)', overflow: 'auto', boxSizing: 'border-box',
      padding: '14px', background: '#161616', border: '1px solid #2e2e2e', borderRadius: '12px', boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
      color: '#ccc', fontSize: '13px', textAlign: 'start', whiteSpace: 'normal', fontVariantNumeric: 'normal',
    }}>{children}</div>
  </span>
}

export function PanelSection({ title, children, class: className }) {
  return <section class={className} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
    {title && <span style={{ ...S.label, marginBottom: 0 }}>{title}</span>}
    {children}
  </section>
}

/**
 * The slide's own controls, as the presenter's slide frame reports them
 * (slideControls.js): a poll's lock, eye, tick and Reset, a video's play,
 * the hotspots' numbers. `press(i)` and `zoom(key)` act on the slide.
 */
export function SlideControls({ controls, press, zoom, big = false }) {
  if (!controls.items.length && !controls.hotspots) return null
  const size = big ? { minWidth: '52px', height: '52px', borderRadius: '14px' } : {}
  return <span class="presenter-slide-controls" role="group" aria-label="This slide" style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
    {controls.items.map((control, i) => <ToolButton key={`c${i}`} class="presenter-slide-control" icon={control.icon ?? 'check'} label={control.label} pressed={control.pressed} disabled={control.disabled} size={big ? 22 : 18} style={size} onClick={() => press(i)} />)}
    {controls.hotspots > 0 && <>
      {Array.from({ length: controls.hotspots }, (_, i) => <ToolButton key={`h${i}`} class="presenter-slide-hotspot" label={`Zoom in on part ${i + 1} (${i + 1})`} pressed={controls.hotspot === i + 1} style={{ ...size, fontVariantNumeric: 'tabular-nums' }} onClick={() => zoom(String(i + 1))}>{i + 1}</ToolButton>)}
      {controls.hotspot != null && <ToolButton class="presenter-slide-whole" icon="fullscreen-exit" label="The whole slide (0)" size={big ? 22 : 18} style={size} onClick={() => zoom('0')} />}
    </>}
  </span>
}

// The launch page's view of this talk: whether devices can pair, from this
// computer under `mdeck run` only.
function useHomeInfo() {
  const [info, setInfo] = useState(null)
  const load = () => fetch(devPath('__mdeck/home/info'), { cache: 'no-store' }).then(response => response.ok ? response.json() : null).then(setInfo, () => setInfo(null))
  useEffect(() => { if (import.meta.env.DEV) load() }, [])
  return [info, load]
}

const PAIR = {
  slide: { icon: 'tablet', label: 'iPad', scan: "Scan with the iPad's camera: the presenter view opens there, to draw on and go through the slides." },
  remote: { icon: 'phone', label: 'Phone clicker', scan: "Scan with the phone's camera: a clicker opens there, with your notes, the time and big buttons." },
}

// Where the phones answer, from the launch page's check of the server: moved
// here, beside who is connected, where the presenter looks during the talk.
function Polls({ live, recheck }) {
  const [copied, setCopied] = useState(false)
  const copy = () => navigator.clipboard?.writeText(live.joinUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }, () => {})
  const pill = ok => ({ marginInlineStart: '6px', padding: '1px 8px', borderRadius: '999px', fontSize: '11px', color: ok ? '#81c995' : '#f28b82', border: `1px solid ${ok ? '#2c4a35' : '#5c2b28'}` })
  return <PanelSection title="Polls" class="presenter-polls">
    <span>{live.server
      ? <><code>{live.server}</code><span style={pill(live.reachable)}>{live.reachable ? `reachable · ${live.ms} ms` : `not reachable · ${live.error}`}</span></>
      : 'Answers go to this computer.'}</span>
    {live.joinUrl
      ? <span style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
        <a href={live.joinUrl} target="_blank" rel="noopener" style={{ color: '#ccc', wordBreak: 'break-all' }}><code>{live.joinUrl}</code></a>
        <button type="button" class="presenter-copy-join" style={{ ...S.btn, padding: '2px 8px' }} onClick={copy}><Icon name={copied ? 'check' : 'copy'} size={14} />{copied ? 'Copied' : 'Copy'}</button>
      </span>
      : <span style={{ color: '#f5a524' }}>Phones cannot reach this computer. Start with <code>--network</code>, or set <code>server</code> in the deck.</span>}
    <span>Session code <code>{live.code}</code>, the same for every poll in this deck. The join button shows the code on the slide.</span>
    {live.server && live.key && <span>Server key <span style={pill(live.keyAccepted)}>{live.keyAccepted ? 'accepted' : live.reachable ? 'not accepted' : 'not checked'}</span></span>}
    <button type="button" class="presenter-recheck" style={{ ...S.btn, alignSelf: 'flex-start' }} onClick={recheck}><Icon name="reset" size={14} />Check again</button>
  </PanelSection>
}

const VIEW_NAME = { presenter: 'Presenter view', audience: 'Audience window', deck: 'Deck window' }

/**
 * Who is connected, behind the icons that show it: the views and devices,
 * the audience window, and the codes that pair an iPad or a phone.
 */
export function Connections({ presence, phones, problem, audienceOpen, openAudience }) {
  const [info, reload] = useHomeInfo()
  const [code, setCode] = useState(null)
  const [error, setError] = useState(null)
  const action = body => fetch(devPath('__mdeck/home/action'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then(async response => { const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error ?? response.status); return result })
  const pair = layout => action({ action: 'pair', layout }).then(result => { setCode({ url: result.url, layout }); setError(null); reload() }, failure => setError(failure.message))
  const unpair = () => action({ action: 'unpair' }).then(() => { setCode(null); reload() }, failure => setError(failure.message))
  const views = presence?.views ?? []
  const kinds = Object.keys(VIEW_NAME).filter(view => views.some(entry => entry.view === view))
  const trigger = kinds.length || phones
    ? <ConnectedViews presence={presence ?? { views: [], phones: 0 }} phones={phones} style={{ color: 'inherit' }} />
    : <Icon name="people" size={18} style={{ display: 'block' }} />
  return <Popover class="presenter-connections" label="Connected screens and devices" trigger={trigger} alert={!!problem}>
    {problem && <p role="status" style={{ margin: 0, color: '#f28b82' }}>{problem}</p>}
    <PanelSection title="Connected">
      {kinds.length === 0 && !phones && <span style={muted}>Only this view.</span>}
      {kinds.map(view => <span key={view}>{VIEW_NAME[view]} on {devicesText(views.filter(entry => entry.view === view))}</span>)}
      {phones && <span>{phonesText(presence?.phones ?? 0)}</span>}
      <button type="button" class="presenter-audience" style={{ ...S.btn, alignSelf: 'flex-start' }} onClick={openAudience}>
        <Icon name="projector" size={16} />{audienceOpen ? 'Open the audience window again' : 'Open the audience window'}
      </button>
    </PanelSection>
    {info?.live && phones && <Polls live={info.live} recheck={reload} />}
    {info?.pairing && <PanelSection title="Pair a device" class="presenter-pairing">
      {!info.pairing.available
        ? <span style={muted}>Start <code>mdeck run</code> with <code>--network</code> so an iPad or a phone in the same network can reach it, or with <code>--server</code>.</span>
        : <>
          <span style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {Object.entries(PAIR).map(([layout, { icon, label }]) => <button key={layout} type="button" class={`presenter-pair presenter-pair--${layout}`} aria-pressed={code?.layout === layout} style={{ ...S.btn, ...(code?.layout === layout ? { background: '#2a2a2a', color: '#fff' } : {}) }} onClick={() => pair(layout)}><Icon name={icon} size={16} />{label}</button>)}
            {info.pairing.devices > 0 && <button type="button" class="presenter-unpair" style={{ ...S.btn, color: '#888' }} onClick={unpair}>Unpair {info.pairing.devices === 1 ? 'the device' : `${info.pairing.devices} devices`}</button>}
          </span>
          {code && <span style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start', '--qr-ink': '#000', '--qr-bg': '#fff' }}>
            <span style={{ background: '#fff', padding: '8px', borderRadius: '8px', lineHeight: 0 }}><QrCode url={code.url} size="168" /></span>
            <span>{PAIR[code.layout].scan}</span>
            <span style={muted}>The code works once, for ten minutes.</span>
          </span>}
          {error && <span style={{ color: '#f28b82' }}>{error}</span>}
        </>}
    </PanelSection>}
  </Popover>
}
