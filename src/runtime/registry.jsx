import CodeBlock from '../components/CodeBlock.jsx'
import QrCode from '../components/QrCode.jsx'
import VideoPlayer from '../components/VideoPlayer.jsx'
import Poll from '../components/Poll.jsx'
import deckComponents from 'virtual:deck-components'

// Maps lowercase HTML tag names to Preact components.
// Add framework-wide components here and use them in slides.md as <tagname ...>.
//
// A deck can also ship its own components in a `components/` folder next to its
// .md file — those are picked up automatically and merged in below, so a widget
// that only one deck needs never becomes part of every other deck's bundle.
// Deck-local components win on a name collision.
export const registry = {
  codeblock: CodeBlock,
  qrcode: QrCode,
  videoplayer: VideoPlayer,
  poll: Poll,
  ...deckComponents,
}
