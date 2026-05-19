import { marked } from 'marked'
import markedKatex from 'marked-katex-extension'
import 'katex/dist/katex.min.css'
import '../components/callout.css'

marked.use(markedKatex({ throwOnError: false, output: 'html' }))

const CALLOUT_DEFAULTS = { note: 'Note', tip: 'Tip', important: 'Important', warning: 'Warning', caution: 'Caution' }

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
      const title = token.title || CALLOUT_DEFAULTS[token.calloutType] || token.calloutType
      return `<div class="callout callout-${token.calloutType}"><div class="callout-title">${title}</div>${this.parser.parse(token.tokens)}</div>\n`
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
