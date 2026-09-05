import { defineConfig } from 'vite'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { baseConfig } from '../src/build/config.js'

const root = dirname(fileURLToPath(import.meta.url))

// A scratch deck for working on mdeck. Production builds use src/runtime/.
export default defineConfig({
  ...baseConfig(resolve(root, 'slides.md')),
  root,
  build: { outDir: resolve(root, 'dist'), emptyOutDir: true },
})
