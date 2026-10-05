import { h } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import mark from '../../assets/logo/mark.svg'
import QrCode from '../components/QrCode.jsx'
import { Icon } from '../components/Icon.jsx'
import { devPath } from '../core/devPath.js'

// Where the dev server serves from: / normally, /t/<id>/ with `mdeck run --server`.
const BASE = devPath('')

// The launch page `mdeck run` opens: every way to show, edit, share and check
// the deck from one place. Data and actions come from /__mdeck/home.

async function api(path, body) {
  const response = await fetch(devPath('__mdeck/home') + path, body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : { cache: 'no-store' })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`)
  return data
}

const HomeIcon = ({ name, size = 18 }) => <Icon name={name} size={size} class="home-icon" />

function ago(iso) {
  if (!iso) return ''
  const seconds = Math.round((Date.now() - new Date(iso)) / 1000)
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return new Date(iso).toLocaleDateString()
}

function ViewTile({ icon, title, text, href }) {
  return <a class="home-tile" href={href} target="_blank" rel="noopener">
    <span class="home-tile-icon"><HomeIcon name={icon} size={22} /></span>
    <span class="home-tile-body"><strong>{title}</strong><span>{text}</span></span>
    <HomeIcon name="external" size={16} />
  </a>
}

// Opens the tab during the click so pop-up blockers allow it, then points it
// at the service (and `page` within it) once the server has started.
async function openService(action, page = '') {
  const tab = window.open('about:blank', '_blank')
  try {
    const { url } = await api('/action', { action })
    const target = new URL(page, url).href
    if (tab) tab.location = target
    else window.open(target, '_blank')
  } catch (error) {
    tab?.close()
    throw error
  }
}

function ServiceTile({ icon, title, text, action, url, onError, onStarted }) {
  const [starting, setStarting] = useState(false)
  const launch = async () => {
    setStarting(true)
    try { await openService(action); onStarted() } catch (error) { onError(error.message) } finally { setStarting(false) }
  }
  return <button class="home-tile" onClick={launch} disabled={starting}>
    <span class="home-tile-icon"><HomeIcon name={icon} size={22} /></span>
    <span class="home-tile-body"><strong>{title}</strong><span>{starting ? 'Starting…' : url ? url.replace(/^https?:\/\//, '') : text}</span></span>
    <HomeIcon name="external" size={16} />
  </button>
}

// A small live copy of the deck. The embedded deck hides its controls, takes
// next/previous commands from this page and reports its slide back; a click
// opens an audience window at that slide.
function Preview({ info }) {
  const frame = useRef(null)
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const follow = event => {
      if (event.source === frame.current?.contentWindow && Number.isInteger(event.data?.slideIndexChanged)) setIndex(event.data.slideIndexChanged)
    }
    window.addEventListener('message', follow)
    return () => window.removeEventListener('message', follow)
  }, [])
  const control = command => frame.current?.contentWindow?.postMessage({ deckControl: { command } }, window.location.origin)
  const audienceUrl = `${BASE}?view=audience&session=${SESSION}#${index + 1}`
  return <section class="home-section">
    <h2>Preview</h2>
    <div class="home-preview" style={{ aspectRatio: `${info.width} / ${info.height}` }}>
      <iframe ref={frame} src={`${BASE}?view=deck&embedded=1`} title="Deck preview" tabIndex={-1} />
      <a class="home-preview-open" href={audienceUrl} target="_blank" rel="noopener" aria-label="Open the audience window" />
    </div>
    <div class="home-preview-bar">
      <button class="home-btn home-btn--small" onClick={() => control('prev')} aria-label="Previous"><HomeIcon name="prev" size={14} /></button>
      <button class="home-btn home-btn--small" onClick={() => control('next')} aria-label="Next"><HomeIcon name="next" size={14} /></button>
      <span class="home-preview-count">{index + 1} / {info.slides}</span>
      <span class="home-spacer" />
      <a class="home-btn home-btn--small" href={audienceUrl} target="_blank" rel="noopener">Open audience window <HomeIcon name="external" size={13} /></a>
    </div>
  </section>
}

const OUTPUT_TEXT = {
  folder: { icon: 'folder', text: 'dist/ with the page, pictures and videos, for a web server or a USB stick.' },
  send: { icon: 'file-code', text: 'A single HTML file without speaker notes that opens in the reader, with the PDF inside.' },
  pdf: { icon: 'file-text', text: 'One page per slide, with interactive slides shown finished.' },
}

function OutputRow({ id, output, chrome, onChange, onError }) {
  const running = output.status === 'running'
  const build = async () => {
    onChange(id, { ...output, status: 'running' })
    try { onChange(id, { ...output, ...(await api('/action', { action: 'build', output: id })), exists: true }) }
    catch (error) { onError(error.message); onChange(id, { ...output, status: 'failed' }) }
  }
  const reveal = () => api('/action', { action: 'reveal', output: id }).catch(error => onError(error.message))
  const blocked = output.needsChrome && !chrome
  const status = running ? 'Building…'
    : output.status === 'failed' ? 'Failed'
    : output.status === 'done' ? `Built ${ago(output.finishedAt)}`
    : output.exists ? 'Built earlier' : 'Not built yet'
  return <li class="home-output">
    <span class="home-tile-icon"><HomeIcon name={OUTPUT_TEXT[id].icon} size={20} /></span>
    <div class="home-output-body">
      <strong>{output.title}</strong>
      <span>{OUTPUT_TEXT[id].text}</span>
      <code title={output.file}>{output.file}</code>
      {output.status === 'failed' && output.log && <details><summary>What went wrong</summary><pre>{output.log}</pre></details>}
      {blocked && <span class="home-note">Needs Chrome or Chromium. Set MDECK_CHROME to its path if it is installed somewhere unusual.</span>}
    </div>
    <div class="home-output-actions">
      <span class={`home-status home-status--${running ? 'running' : output.status === 'failed' ? 'failed' : output.exists ? 'done' : 'idle'}`}>{status}</span>
      <button class="home-btn home-btn--primary" onClick={build} disabled={running || blocked}>{output.exists ? 'Build again' : 'Build'}</button>
      <button class="home-btn" onClick={reveal} disabled={!output.exists || running} title="Show in your file manager"><HomeIcon name="folder-open" size={15} />Show</button>
    </div>
  </li>
}

function Diagnostics({ diagnostics, name }) {
  if (!diagnostics.length) return <p class="home-ok"><HomeIcon name="check" /> No problems found in {name}.</p>
  return <ul class="home-diagnostics">
    {diagnostics.map((d, i) => <li key={i} class={`home-diagnostic home-diagnostic--${d.severity}`}>
      <span class="home-badge">{d.severity}</span>
      <span>{d.message}</span>
      {d.line > 1 && <span class="home-line">line {d.line}</span>}
    </li>)}
  </ul>
}

function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1400) } catch {}
  }
  return <button class="home-btn home-btn--small" onClick={copy}><HomeIcon name={copied ? 'check' : 'copy'} size={14} />{copied ? 'Copied' : label}</button>
}

// One session pairs the presenter view with the audience window, so both
// links on this page drive each other.
const SESSION = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)

// For decks with a `server` setting: the server's health, the viewers' link
// and the key (MDECK_SERVER_KEY) that lets a browser steer phones and reset
// polls.
function LivePolls({ live, onRecheck }) {
  const presenterUrl = `${BASE}?view=presenter&session=${SESSION}${live.key ? `&serverkey=${encodeURIComponent(live.key)}` : ''}`
  const keyState = !live.key ? null : live.keyAccepted ? ['is-ok', 'Accepted by the server'] : live.reachable ? ['is-bad', 'Not accepted by the server'] : ['is-idle', 'Not checked']
  return <section class="home-section">
    <div class="home-section-head">
      <h2>Polls</h2>
      <button class="home-btn home-btn--small" onClick={onRecheck}>Check again</button>
    </div>
    <dl class="home-live">
      <div>
        <dt>Server</dt>
        <dd>
          {live.server
            ? <><code>{live.server}</code><span class={`home-pill ${live.reachable ? 'is-ok' : 'is-bad'}`}>{live.reachable ? `Reachable · ${live.ms} ms` : `Not reachable · ${live.error}`}</span></>
            : <span>Built into this dev server</span>}
        </dd>
      </div>
      <div>
        <dt>Join link for phones</dt>
        <dd>
          {live.joinUrl
            ? <><a href={live.joinUrl} target="_blank" rel="noopener"><code>{live.joinUrl}</code></a> <CopyButton text={live.joinUrl} /></>
            : <>
              <p class="home-note">Phones cannot reach this computer. Start with <code>--network</code>, or set <code>server</code> in the deck.</p>
              {live.localJoinUrl && <p><a href={live.localJoinUrl} target="_blank" rel="noopener">Try the answer page here</a> <span>in another browser tab or window.</span></p>}
            </>}
          <p>Session code <code class="home-code">{live.code}</code>, the same for every poll in this deck.</p>
        </dd>
      </div>
      {live.server && <div>
        <dt>Server key</dt>
        <dd>
          {live.key
            ? <>
              <code class="home-code">{live.key}</code> <CopyButton text={live.key} />
              <span class={`home-pill ${keyState[0]}`}>{keyState[1]}</span>
              <p>The presenter view and audience window buttons above carry it. Or open <a href={presenterUrl} target="_blank" rel="noopener">the presenter view with the key</a>.</p>
            </>
            : <p>Start <code>mdeck run</code> with <code>MDECK_SERVER_KEY</code> set to the server's key to see it here.</p>}
        </dd>
      </div>}
    </dl>
  </section>
}

// Presenting from an iPad: a one-time QR code opens the presenter view there,
// paired with this server so it may save ink and steer the projector, which
// shows the audience window on this computer.
function Tablet({ pairing, relay, onChange, onError }) {
  const [url, setUrl] = useState(null)
  const offer = () => api('/action', { action: 'pair' }).then(result => { setUrl(result.url); onChange() }).catch(error => onError(error.message))
  const unpair = () => api('/action', { action: 'unpair' }).then(() => { setUrl(null); onChange() }).catch(error => onError(error.message))
  return <section class="home-section home-tablet">
    <div class="home-section-head">
      <h2>Present from an iPad</h2>
      {pairing.devices > 0 && <button class="home-btn home-btn--small" onClick={unpair}>Unpair {pairing.devices === 1 ? 'the device' : `${pairing.devices} devices`}</button>}
    </div>
    {relay && <p class={`home-note home-relay home-relay--${relay.state}`}>{relay.state === 'up' ? 'Connected to your server: the iPad can reach this computer from any network.' : relay.state === 'refused' ? `Connecting to the server failed: ${relay.reason}` : relay.state === 'down' ? 'Lost the connection to the server; reconnecting…' : 'Connecting to your server…'}</p>}
    {!pairing.available
      ? <p class="home-note">Start <code>mdeck run</code> with <code>--network</code>, so an iPad in the same network can reach it, or with <code>--server</code> to reach it through your server.</p>
      : url
        ? <div class="home-pair">
          <QrCode url={url} size="180" />
          <div>
            <p>Scan this with the iPad's camera. It opens the presenter view there, where you draw and go through the slides.</p>
            <p>Show the <a href={`${BASE}?view=audience&session=${SESSION}`} target="_blank" rel="noopener">audience window</a> on the projector from this computer: it follows the iPad.</p>
            <p class="home-note">The code works once, for ten minutes. {pairing.devices > 0 ? `${pairing.devices} paired so far.` : ''}</p>
          </div>
        </div>
        : <>
          <p>Draw and steer from an iPad while this computer drives the projector. Drawings are saved in the drawings file beside the deck.</p>
          <button class="home-btn" onClick={offer}>Show pairing code</button>
          {pairing.devices > 0 && <p class="home-note">{pairing.devices} paired.</p>}
        </>}
  </section>
}

export function Home() {
  const [info, setInfo] = useState(null)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')

  const load = () => api('/info').then(data => { setInfo(data); setLoadError('') }).catch(e => setLoadError(e.message))
  useEffect(() => {
    load()
    const icon = document.querySelector('link[rel=icon]') ?? document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'icon' }))
    icon.href = mark
    window.addEventListener('focus', load)
    return () => window.removeEventListener('focus', load)
  }, [])
  useEffect(() => { if (info) document.title = `${info.title} · mdeck` }, [info?.title])
  // The connection to the server comes up a moment after the page; look again until it does.
  const sharing = info?.relay && info.relay.state !== 'up' && info.relay.state !== 'refused'
  useEffect(() => {
    if (!sharing) return
    const timer = setInterval(load, 2000)
    return () => clearInterval(timer)
  }, [sharing])

  if (!info) return <main class="home home--empty">
    <img src={mark} alt="" width="48" height="48" />
    <p>{loadError ? `The launch page could not load: ${loadError}` : 'Loading…'}</p>
    {loadError && <p><a href={`${BASE}?view=audience`}>Open the audience window</a></p>}
  </main>

  const errors = info.diagnostics.filter(d => d.severity === 'error').length
  const warnings = info.diagnostics.length - errors
  const setOutput = (id, output) => setInfo(current => ({ ...current, outputs: { ...current.outputs, [id]: output } }))
  // With the server key, every screen opened here may move the phones along.
  const code = info.live?.key ? `&serverkey=${encodeURIComponent(info.live.key)}` : ''
  const meta = [`${info.slides} slide${info.slides === 1 ? '' : 's'}`, info.notes ? `${info.notes} with notes` : 'no speaker notes', `theme ${info.theme}${info.palette ? ` · ${info.palette}` : ''}`, `saved ${ago(info.modified)}`]

  return <main class="home">
    <header class="home-header">
      <img class="home-mark" src={mark} alt="mdeck" width="26" height="26" />
      <div class="home-heading">
        <h1>{info.title}</h1>
        <p class="home-meta">{meta.join(' · ')}</p>
        <p class="home-file"><code>{info.file}</code> <button class="home-link" onClick={() => api('/action', { action: 'reveal', output: 'deck' }).catch(e => setError(e.message))}>Show</button></p>
      </div>
      <a class={`home-health${errors ? ' is-bad' : warnings ? ' is-warn' : ''}`} href="#check">
        <HomeIcon name={errors || warnings ? 'alert' : 'check'} />
        {errors ? `${errors} error${errors === 1 ? '' : 's'}` : warnings ? `${warnings} warning${warnings === 1 ? '' : 's'}` : 'All good'}
      </a>
    </header>

    {error && <div class="home-error" role="alert"><span>{error}</span><button class="home-link" onClick={() => setError('')}>Dismiss</button></div>}

    <div class="home-grid">
      <Preview info={info} />

      <section class="home-section">
        <h2>Present</h2>
        <div class="home-tiles">
          <ViewTile icon="presenter" title="Presenter view" text="Present and draw, with notes, timer and next slide. Switch to slides only or fullscreen." href={`${BASE}?view=presenter&session=${SESSION}${code}`} />
          <ViewTile icon="projector" title="Audience window" text="Slides for the projector, without notes. Navigation stays in sync with the presenter." href={`${BASE}?view=audience&session=${SESSION}${code}`} />
          <ViewTile icon="reader" title="Reader view" text="Outline, reading mode and look picker, as people you send it to see it." href={`${BASE}?view=reader`} />
        </div>
      </section>

      <section class={`home-section${info.live ? '' : ' home-section--wide'}`}>
        <h2>Write and learn</h2>
        <div class="home-tiles">
          <ServiceTile icon="editor" title="Visual editor" text="Forms and a live preview; saves into the file and keeps a backup." action="editor" url={info.services.editor} onError={setError} onStarted={load} />
          <ServiceTile icon="guides" title="Guides" text="How to write slides, layouts, presenting, sharing and more." action="docs" url={info.services.docs} onError={setError} onStarted={load} />
        </div>
      </section>

      {info.live && <LivePolls live={info.live} onRecheck={load} />}

      {info.pairing && <Tablet pairing={info.pairing} relay={info.relay} onChange={load} onError={setError} />}

      <section class="home-section home-section--wide">
        <h2>Share</h2>
        <ul class="home-outputs">
          {Object.entries(info.outputs).map(([id, output]) => <OutputRow key={id} id={id} output={output} chrome={info.chrome} onChange={setOutput} onError={setError} />)}
        </ul>
      </section>

      <section class="home-section home-section--wide" id="check">
        <div class="home-section-head">
          <h2>Check</h2>
          <button class="home-btn home-btn--small" onClick={load}>Check again</button>
        </div>
        <Diagnostics diagnostics={info.diagnostics} name={info.name} />
      </section>
    </div>
  </main>
}
