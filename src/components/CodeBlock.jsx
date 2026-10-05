import { h } from 'preact'
import { useState, useMemo, useRef } from 'preact/hooks'
import Prism from 'prismjs'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-markup'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-sql'
import { Icon } from './Icon.jsx'
import './code-block.css'

// ─── Syntax highlighting ───────────────────────────────────────────────────

function hl(code, lang) {
  const g = Prism.languages[lang]
  if (!g) return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return Prism.highlight(code, g, lang)
}

// ─── Execution engines ─────────────────────────────────────────────────────

async function execJS(code) {
  const lines = []
  const con = {
    log:   (...a) => lines.push(a.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(' ')),
    error: (...a) => lines.push(a.map(String).join(' ')),
    warn:  (...a) => lines.push(a.map(String).join(' ')),
  }
  try {
    const fn = new Function('console', `return (async()=>{\n${code}\n})()`)
    const result = await fn(con)
    if (result !== undefined && !lines.length) lines.push(String(result))
    return { output: lines.join('\n') }
  } catch (e) {
    return { error: e.message }
  }
}

let _pyodide = null
let _pyodideLoading = null
async function execPython(code) {
  try {
    if (!_pyodide) {
      if (!_pyodideLoading) {
        _pyodideLoading = new Promise((res, rej) => {
          const s = Object.assign(document.createElement('script'), {
            src: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js',
            onload: res,
            onerror: () => rej(new Error('Failed to load Pyodide — serve the file over HTTP to run Python.')),
          })
          document.head.appendChild(s)
        }).then(() => window.loadPyodide())
      }
      _pyodide = await _pyodideLoading
    }
    let out = ''
    _pyodide.setStdout({ batched: s => { out += s + '\n' } })
    _pyodide.setStderr({ batched: s => { out += s + '\n' } })
    const r = await _pyodide.runPythonAsync(code)
    if (r != null && !out.trim()) out = String(r)
    return { output: out.trim() }
  } catch (e) {
    _pyodideLoading = null
    return { error: e.message }
  }
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function CodeBlock({ lang = 'text', children = '', live, copy, editable }) {
  const isLive     = live     != null
  const isCopy     = copy     != null
  const isEditable = editable != null
  const isPython   = lang === 'python' || lang === 'py'

  const [code, setCode]       = useState(() => String(children).trim())
  const [output, setOutput]   = useState(null)
  const [isError, setIsError] = useState(false)
  const [running, setRunning] = useState(false)
  const [copied, setCopied]   = useState(false)

  const highlighted = useMemo(() => hl(code, lang), [code, lang])
  const highlightRef = useRef(null)

  function syncScroll(e) {
    if (highlightRef.current) {
      highlightRef.current.scrollTop  = e.currentTarget.scrollTop
      highlightRef.current.scrollLeft = e.currentTarget.scrollLeft
    }
  }

  async function handleRun() {
    setRunning(true)
    setOutput(null)
    setIsError(false)
    const result = await (isPython ? execPython : execJS)(code)
    setRunning(false)
    setIsError(!!result.error)
    setOutput(result.error ?? result.output ?? '')
  }

  async function handleCopy() {
    try { await navigator.clipboard.writeText(code) } catch {}
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div class="code-block-wrapper">
      {isEditable ? (
        <div class="code-editable-container">
          <pre ref={highlightRef} class={`code-block code-editable-highlight language-${lang}`} aria-hidden="true">
            <code dangerouslySetInnerHTML={{ __html: highlighted }} />
          </pre>
          <textarea
            class="code-block code-editable-input"
            value={code}
            onInput={e => setCode(e.currentTarget.value)}
            onScroll={syncScroll}
            spellcheck={false}
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
          />
        </div>
      ) : (
        <pre class={`code-block language-${lang}`}>
          <code dangerouslySetInnerHTML={{ __html: highlighted }} />
        </pre>
      )}

      {(isCopy || isLive) && (
        <div class="code-block-actions">
          {isCopy && (
            <button class="code-btn" onClick={handleCopy} title={copied ? 'Copied!' : 'Copy'}>
              <Icon name={copied ? 'check' : 'copy'} size={18} />
            </button>
          )}
          {isLive && (
            <button class="code-btn code-btn--run" onClick={handleRun} disabled={running} title="Run">
              {running ? <Icon name="loading" size={18} class="icon code-btn-spin" /> : <Icon name="play" size={18} />}
            </button>
          )}
        </div>
      )}

      {output !== null && (
        <pre class={`code-output${isError ? ' code-output--error' : ''}`}>
          {output || '(no output)'}
        </pre>
      )}
    </div>
  )
}
