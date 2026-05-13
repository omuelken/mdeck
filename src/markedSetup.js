import { marked } from 'marked'

// Convert fenced code blocks to <codeblock> elements so the component
// registry can hydrate them with syntax highlighting.
marked.use({
  renderer: {
    code({ text, lang }) {
      const safeLang = lang || 'text'
      // HTML-encode content so angle brackets in code aren't parsed as tags
      const encoded = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      return `<codeblock lang="${safeLang}">${encoded}</codeblock>`
    },
  },
})
