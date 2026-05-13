import { defineConfig } from 'vite'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import preact from '@preact/preset-vite'
import { slidesPlugin } from './src/slidesPlugin.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const defaultSlides = resolve(__dirname, 'examples/demo.md')

// This config is used by `npm run dev/build` against the demo deck.
// For compiling arbitrary decks use: node bin/deck.js dev <file.md>
export default defineConfig({
  plugins: [preact(), slidesPlugin(defaultSlides)],
})
