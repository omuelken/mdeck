import { marked } from 'marked'

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
