import { h } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import mark from '../../assets/logo/mark.svg'

// The launch page `mdeck dev` opens: every way to show, edit, share and check
// the deck from one place. Data and actions come from /__mdeck/home.

async function api(path, body) {
  const response = await fetch('/__mdeck/home' + path, body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : { cache: 'no-store' })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`)
  return data
}

const ICONS = {
  presenter: 'M3 4h12v9H3zM9 13v3M6 16h6M17 7h4M17 11h4M17 15h4',
  deck: 'M4 5h16v11H4zM12 16v4M8 20h8',
  reader: 'M4 4h6v16H4zM12 4h8v16h-8zM14 8h4M14 12h4M14 16h2',
  editor: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  docs: 'M5 4h10l4 4v12H5zM15 4v4h4M8 12h8M8 16h6',
  folder: 'M3 6h6l2 2h10v11H3z',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4',
  pdf: 'M6 3h8l4 4v14H6zM9 13h6M9 17h4',
  phone: 'M8 3h8v18H8zM11 18h2',
  check: 'M5 12l5 5 9-10',
  alert: 'M12 4l9 16H3zM12 10v4M12 17v.5',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  reveal: 'M4 7h6l2 2h8v9H4zM12 12v4M10 14h4',
  arrow: 'M7 17L17 7M9 7h8v8',
}
function Icon({ name, size = 18 }) {
  return <svg class="home-icon" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={ICONS[name]} /></svg>
}

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
    <span class="home-tile-icon"><Icon name={icon} size={22} /></span>
    <span class="home-tile-body"><strong>{title}</strong><span>{text}</span></span>
    <Icon name="arrow" size={16} />
  </a>
}

// Opens the tab during the click so pop-up blockers allow it, then points it
// at the service once the server has started.
function ServiceTile({ icon, title, text, action, url, onError, onStarted }) {
  const [starting, setStarting] = useState(false)
  const launch = async () => {
    const tab = window.open('about:blank', '_blank')
    setStarting(true)
    try {
      const result = await api('/action', { action })
      if (tab) tab.location = result.url
      else window.open(result.url, '_blank')
      onStarted()
    } catch (error) {
      tab?.close()
      onError(error.message)
    } finally { setStarting(false) }
  }
  return <button class="home-tile" onClick={launch} disabled={starting}>
    <span class="home-tile-icon"><Icon name={icon} size={22} /></span>
    <span class="home-tile-body"><strong>{title}</strong><span>{starting ? 'Starting…' : url ? url.replace(/^https?:\/\//, '') : text}</span></span>
    <Icon name="arrow" size={16} />
  </button>
}

const OUTPUT_TEXT = {
  folder: { icon: 'folder', text: 'dist/ with the page, pictures and videos, for a web server or a USB stick.' },
  share: { icon: 'file', text: 'A single HTML file without speaker notes that opens in the reader, with the PDF inside.' },
  pdf: { icon: 'pdf', text: 'One page per slide, with interactive slides shown finished.' },
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
    <span class="home-tile-icon"><Icon name={OUTPUT_TEXT[id].icon} size={20} /></span>
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
      <button class="home-btn" onClick={reveal} disabled={!output.exists || running} title="Show in your file manager"><Icon name="reveal" size={15} />Show</button>
    </div>
  </li>
}

function Diagnostics({ diagnostics, name }) {
  if (!diagnostics.length) return <p class="home-ok"><Icon name="check" /> No problems found in {name}.</p>
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
  return <button class="home-btn home-btn--small" onClick={copy}><Icon name={copied ? 'check' : 'copy'} size={14} />{copied ? 'Copied' : label}</button>
}

const TABS = [['layouts', 'Layouts'], ['components', 'Components'], ['themes', 'Themes'], ['palettes', 'Colour palettes']]

function BuildingBlocks({ info }) {
  const [tab, setTab] = useState('layouts')
  return <section class="home-section home-section--wide">
    <div class="home-section-head">
      <h2>What you can use</h2>
      <div class="home-tabs" role="tablist">
        {TABS.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} class={`home-tab${tab === id ? ' is-active' : ''}`} onClick={() => setTab(id)}>{label}</button>)}
      </div>
    </div>
    {tab === 'layouts' && <ul class="home-blocks">{info.layouts.map(layout => <li key={layout.id} class="home-block">
      <div><strong>{layout.title}</strong> <code>layout: {layout.id}</code>{layout.source !== 'built-in' && <span class="home-tag">{layout.source}</span>}</div>
      {layout.description && <p>{layout.description}</p>}
      <pre>{layout.starter.trim()}</pre>
      <CopyButton text={layout.starter} label="Copy starter" />
    </li>)}</ul>}
    {tab === 'components' && <ul class="home-blocks">{info.components.map(component => <li key={component.tag} class="home-block">
      <div><strong>&lt;{component.tag}&gt;</strong><span class="home-tag" title={component.folder}>{component.source === 'deck' ? 'this deck' : component.source === 'shared' ? component.folder : 'built-in'}</span></div>
      <pre>{component.example}</pre>
      <CopyButton text={component.example} />
    </li>)}</ul>}
    {tab === 'themes' && <ul class="home-list">{info.themes.map(theme => <li key={theme.id} class={theme.id === info.design ? 'is-current' : ''}>
      <strong>{theme.title}</strong> <code>design: {theme.id}</code>{theme.id === info.design && <span class="home-tag">in use</span>}
      {theme.description && <p>{theme.description}</p>}
    </li>)}</ul>}
    {tab === 'palettes' && <ul class="home-list">{info.palettes.map(palette => <li key={palette.id} class={palette.id === info.palette ? 'is-current' : ''}>
      <strong>{palette.title}</strong> <code>palette: {palette.id}</code>{palette.id === info.palette && <span class="home-tag">in use</span>}
      {palette.description && <p>{palette.description}</p>}
    </li>)}</ul>}
  </section>
}

const KEYS = [
  ['→  Space  PgDn', 'Next step or slide'],
  ['←  PgUp', 'Previous step or slide'],
  ['Home  End', 'First or last slide'],
  ['1 … 9, 0', 'Jump to slide 1 to 10'],
  ['R', 'Back to the start, steps reset'],
]

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

  if (!info) return <main class="home home--empty">
    <img src={mark} alt="" width="48" height="48" />
    <p>{loadError ? `The launch page could not load: ${loadError}` : 'Loading…'}</p>
    {loadError && <p><a href="/?view=deck">Open the deck</a></p>}
  </main>

  const errors = info.diagnostics.filter(d => d.severity === 'error').length
  const warnings = info.diagnostics.length - errors
  const setOutput = (id, output) => setInfo(current => ({ ...current, outputs: { ...current.outputs, [id]: output } }))
  const meta = [`${info.slides} slide${info.slides === 1 ? '' : 's'}`, info.notes ? `${info.notes} with notes` : 'no speaker notes', `theme ${info.design}${info.palette ? ` · ${info.palette}` : ''}`, `saved ${ago(info.modified)}`]

  return <main class="home">
    <header class="home-header">
      <img class="home-mark" src={mark} alt="mdeck" width="40" height="40" />
      <div class="home-heading">
        <h1>{info.title}</h1>
        <p class="home-meta">{meta.join(' · ')}</p>
        <p class="home-file"><code>{info.file}</code> <button class="home-link" onClick={() => api('/action', { action: 'reveal', output: 'deck' }).catch(e => setError(e.message))}>Show</button></p>
      </div>
      <a class={`home-health${errors ? ' is-bad' : warnings ? ' is-warn' : ''}`} href="#check">
        <Icon name={errors || warnings ? 'alert' : 'check'} />
        {errors ? `${errors} error${errors === 1 ? '' : 's'}` : warnings ? `${warnings} warning${warnings === 1 ? '' : 's'}` : 'All good'}
      </a>
    </header>

    {error && <div class="home-error" role="alert"><span>{error}</span><button class="home-link" onClick={() => setError('')}>Dismiss</button></div>}

    <div class="home-grid">
      <section class="home-section">
        <h2>Present</h2>
        <div class="home-tiles">
          <ViewTile icon="presenter" title="Presenter view" text="Notes, timer and next slide; opens the audience window for the projector." href="/?view=presenter" />
          <ViewTile icon="deck" title="Full-screen deck" text="Just the slides, for rehearsing or a single screen." href="/?view=deck" />
          <ViewTile icon="reader" title="Reader view" text="Outline, reading mode and look picker, as people you send it to see it." href="/?view=share" />
        </div>
      </section>

      <section class="home-section">
        <h2>Write and learn</h2>
        <div class="home-tiles">
          <ServiceTile icon="editor" title="Visual editor" text="Forms and a live preview; saves into the file and keeps a backup." action="editor" url={info.services.editor} onError={setError} onStarted={load} />
          <ServiceTile icon="docs" title="Guides" text="How to write slides, layouts, presenting, sharing and more." action="docs" url={info.services.docs} onError={setError} onStarted={load} />
        </div>
        <div class="home-phone">
          <h3><Icon name="phone" /> Slides on a phone</h3>
          {info.phoneQr
            ? <div class="home-qr-row">
              <div class="home-qr" dangerouslySetInnerHTML={{ __html: info.phoneQr }} />
              <p>Scan to read the slides on a phone or tablet in the same network. They don't follow the presenter.<br /><code>{new URL('?view=share', info.urls.network).href}</code></p>
            </div>
            : <p>Start with <code>mdeck dev {info.name} --host</code> to make the slides reachable from phones and tablets in the same network. A QR code appears here.</p>}
        </div>
      </section>

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

      <BuildingBlocks info={info} />

      <section class="home-section home-section--wide">
        <h2>While presenting</h2>
        <dl class="home-keys">
          {KEYS.map(([keys, action]) => <div key={keys}><dt>{keys.split('  ').map(k => <kbd key={k}>{k}</kbd>)}</dt><dd>{action}</dd></div>)}
        </dl>
      </section>
    </div>

    <footer class="home-footer">mdeck · this page lives only on your computer while <code>mdeck dev</code> runs</footer>
  </main>
}
