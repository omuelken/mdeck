import { marked } from 'marked'
import markedKatex from 'marked-katex-extension'
import 'katex/dist/katex.min.css'
import '../components/callout.css'
import '../components/columns.css'
import { scanDirectives, sourceLines, fenceState } from '../core/source.js'

function readDirective(src, name) {
  if (!/^:::\s*[\w-]+/.test(src)) return null
  const node = scanDirectives(src).nodes[0]
  if (!node || node.end == null || (name && node.name !== name)) return null
  return { ...node, raw: src.slice(0, node.end), body: src.slice(node.bodyStart, node.bodyEnd) }
}

function splitColumns(src) {
  const columns = []
  let start = 0, depth = 0, fence = null
  for (const line of sourceLines(src)) {
    const before = fence
    fence = fenceState(line.text, fence)
    if (before || fence) continue
    if (/^:::\s*[\w-]+/.test(line.text)) depth++
    else if (/^:::\s*$/.test(line.text)) depth--
    if (!depth && /^\+\+\+[ \t]*$/.test(line.text)) {
      columns.push(src.slice(start, line.start))
      start = line.end
    }
  }
  columns.push(src.slice(start))
  return columns
}

function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

marked.use(markedKatex({ throwOnError: false, output: 'html' }))

// marked.use() prepends via unshift, so last-registered = highest priority.
// Register callout first (lowest priority) so columns and steps match before it.
const CALLOUT_LABELS = {
  en: { note: 'Note',    tip: 'Tip',  important: 'Important', warning: 'Warning', caution: 'Caution'  },
  de: { note: 'Hinweis', tip: 'Tipp', important: 'Wichtig',   warning: 'Achtung', caution: 'Vorsicht' },
}

let calloutLabels = CALLOUT_LABELS.en

// Ein Deck waehlt mit `lang` einen Satz Standardbeschriftungen und kann mit
// `callouts` einzelne davon ueberschreiben. Ohne Angabe bleibt es bei
// Englisch, damit bestehende Decks unveraendert aussehen. Ein Titel hinter
// dem Typ (`::: tip Eigener Titel`) sticht beides.
export function setCalloutLabels({ lang, callouts } = {}) {
  const base = CALLOUT_LABELS[String(lang ?? '').toLowerCase()] ?? CALLOUT_LABELS.en
  calloutLabels = { ...base, ...(callouts ?? {}) }
}

marked.use({
  extensions: [{
    name: 'callout',
    level: 'block',
    start(src) { return src.match(/^:::/m)?.index },
    tokenizer(src) {
      const m = readDirective(src)
      if (!m) return
      const token = { type: 'callout', raw: m.raw, calloutType: m.name.toLowerCase(), title: m.argument, tokens: [] }
      this.lexer.blockTokens(m.body, token.tokens)
      return token
    },
    renderer(token) {
      const title = token.title || calloutLabels[token.calloutType] || token.calloutType
      return `<div class="callout callout-${token.calloutType}"><div class="callout-title">${escapeHtml(title)}</div>${this.parser.parse(token.tokens)}</div>\n`
    },
  }],
})

marked.use({
  extensions: [{
    name: 'columns',
    level: 'block',
    start(src) { return src.match(/^:::columns\b/m)?.index },
    tokenizer(src) {
      const m = readDirective(src, 'columns')
      if (!m) return
      const colSrcs = splitColumns(m.body)
      const token = { type: 'columns', raw: m.raw, columns: [] }
      for (const colSrc of colSrcs) {
        const colTokens = []
        this.lexer.blockTokens(colSrc.trim(), colTokens)
        token.columns.push(colTokens)
      }
      return token
    },
    renderer(token) {
      const cols = token.columns
        .map(colTokens => `<div class="column">${this.parser.parse(colTokens)}</div>`)
        .join('\n')
      return `<div class="columns">\n${cols}\n</div>\n`
    },
  }],
})

marked.use({
  extensions: [{
    name: 'steps',
    level: 'block',
    start(src) { return src.match(/^:::steps\b/m)?.index },
    tokenizer(src) {
      const m = readDirective(src, 'steps')
      if (!m) return
      const token = { type: 'steps', raw: m.raw, tokens: [] }
      this.lexer.blockTokens(m.body, token.tokens)
      return token
    },
    renderer(token) {
      let counter = 0
      const links = token.tokens.links || {}
      const parts = []
      for (const t of token.tokens) {
        if (t.type === 'space') continue
        if (t.type === 'list') {
          const tag = t.ordered ? 'ol' : 'ul'
          const items = t.items.map(item => {
            const body = this.parser.parse(Object.assign([...item.tokens], { links }))
            return `<li data-step="${counter++}">${body}</li>`
          })
          parts.push(`<${tag}>${items.join('')}</${tag}>`)
        } else {
          const html = this.parser.parse(Object.assign([t], { links }))
          parts.push(`<div data-step="${counter++}">${html}</div>`)
        }
      }
      return `<div class="steps-container">\n${parts.join('\n')}\n</div>\n`
    },
  }],
})

marked.use({
  renderer: {
    code(code, infoString) {
      const [lang = 'text', ...flags] = (infoString || '').split(/\s+/).filter(Boolean)
      const attrs = flags.map(f => `${f}=""`).join(' ')
      const encoded = (code || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      return `<codeblock lang="${lang}"${attrs ? ' ' + attrs : ''}>${encoded}</codeblock>`
    },
  },
})
