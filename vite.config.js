import { defineConfig } from 'vite'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import preact from '@preact/preset-vite'
import { slidesPlugin } from './src/slidesPlugin.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Used by `npm run dev/build` against the demo deck.
// For arbitrary decks use: node cli.js dev <file.md>
export default defineConfig({
  plugins: [preact(), slidesPlugin(resolve(__dirname, 'examples/demo.md'))],
})
