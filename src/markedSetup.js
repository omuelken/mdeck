import { marked } from 'marked'
import markedKatex from 'marked-katex-extension'
import { markedAlert } from 'marked-alert'
import 'katex/dist/katex.min.css'
import '../components/callout.css'

marked.use(markedKatex({ throwOnError: false, output: 'html' }))
marked.use(markedAlert())

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
