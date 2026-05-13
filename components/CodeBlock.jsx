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

export default function CodeBlock({ lang = 'text', children = '' }) {
  const grammar = Prism.languages[lang] ?? Prism.languages.plain
  const highlighted = grammar
    ? Prism.highlight(children, grammar, lang)
    : children

  return (
    <pre class={`code-block language-${lang}`}>
      <code
        class={`language-${lang}`}
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </pre>
  )
}
