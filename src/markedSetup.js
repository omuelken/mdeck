import { marked } from 'marked'
import markedKatex from 'marked-katex-extension'
import 'katex/dist/katex.min.css'
import '../components/callout.css'
import '../components/columns.css'

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
    start(src) { return src.match(/^:::/)?.index },
    tokenizer(src) {
      const m = src.match(/^:::\s*(\w+)(.*?)\n([\s\S]*?)\n:::\s*(?:\n|$)/)
      if (!m) return
      const token = { type: 'callout', raw: m[0], calloutType: m[1].toLowerCase(), title: m[2].trim(), tokens: [] }
      this.lexer.blockTokens(m[3], token.tokens)
      return token
    },
    renderer(token) {
      const title = token.title || calloutLabels[token.calloutType] || token.calloutType
      return `<div class="callout callout-${token.calloutType}"><div class="callout-title">${title}</div>${this.parser.parse(token.tokens)}</div>\n`
    },
  }],
})

marked.use({
  extensions: [{
    name: 'columns',
    level: 'block',
    start(src) { return src.match(/^:::columns/)?.index },
    tokenizer(src) {
      const m = src.match(/^:::columns[ \t]*\n([\s\S]*?)\n:::[ \t]*(?:\n|$)/)
      if (!m) return
      const colSrcs = m[1].split(/\n\+\+\+[ \t]*\n/)
      const token = { type: 'columns', raw: m[0], columns: [] }
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
    start(src) { return src.match(/^:::steps/)?.index },
    tokenizer(src) {
      const m = src.match(/^:::steps\s*\n([\s\S]*?)\n:::\s*(?:\n|$)/)
      if (!m) return
      const token = { type: 'steps', raw: m[0], tokens: [] }
      this.lexer.blockTokens(m[1], token.tokens)
      return token
    },
    renderer(token) {
      let counter = 0
      const links = token.tokens.links || {}
      const parts = []
      for (const t of token.tokens) {
        if (t.type === 'list') {
          const tag = t.ordered ? 'ol' : 'ul'
          const items = t.items.map(item => {
            const body = item.loose
              ? this.parser.parse(Object.assign([...item.tokens], { links }))
              : this.parser.parseInline(item.tokens[0]?.tokens ?? [])
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
