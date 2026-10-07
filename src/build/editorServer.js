// The `mdeck edit` server, also started on demand from the launch page. It
// listens on loopback only and never reloads pages when the deck changes.
// `open` is true for the editor, or the path of another page to open.
import { createServer } from 'vite'
import preact from '@preact/preset-vite'
import { dirname, resolve } from 'node:path'
import { baseConfig } from './config.js'
import { slidesPlugin } from './slidesPlugin.js'
import { editorPlugin, BACKUP_DIR } from './editorPlugin.js'
import { sampleDeck, sampleDataUrl } from '../editor/sampleDeck.js'

export function createEditorServer(slidesPath, { port = 5173, strictPort = false, open = false } = {}) {
  const abs = resolve(slidesPath)
  const base = baseConfig(abs)
  return createServer({
    ...base,
    plugins: [preact(), slidesPlugin(abs, { editor: true }), editorPlugin(abs)],
    publicDir: dirname(abs),
    server: { ...base.server, host: '127.0.0.1', cors: false, port, strictPort, open: open === true ? '/editor.html' : open || false, watch: { ignored: [`**/${BACKUP_DIR}/**`] } },
  })
}

// `mdeck design` without a deck: the design page on the sample deck, making
// and changing the extensions in `folder`/extensions, where a deck in that
// folder finds them. No deck file is read or written.
export function createDesignServer(folder, { port = 5173, strictPort = false, open = false } = {}) {
  const abs = resolve(folder, 'design.md')
  const source = sampleDeck(sampleDataUrl())
  const base = baseConfig(abs, { source })
  return createServer({
    ...base,
    plugins: [preact(), slidesPlugin(abs, { editor: true, source, ink: false }), editorPlugin(abs, { source })],
    publicDir: false,
    server: { ...base.server, host: '127.0.0.1', cors: false, port, strictPort, open: open === true ? '/design.html' : open || false },
  })
}
