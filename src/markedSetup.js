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
      return `<div class="callout callout-${token.calloutType}"><p class="callout-title">${title}</p>${this.parser.parse(token.tokens)}</div>\n`
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
