import CodeBlock from '../components/CodeBlock.jsx'
import QrCode from '../components/QrCode.jsx'

// Maps lowercase HTML tag names to Preact components.
// Add new components here and use them in slides.md as <tagname ...>.
export const registry = {
  codeblock: CodeBlock,
  qrcode: QrCode,
}
