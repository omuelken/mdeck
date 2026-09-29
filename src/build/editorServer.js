// The `mdeck edit` server, also started on demand from the launch page. It
// listens on loopback only and never reloads pages when the deck changes.
import { createServer } from 'vite'
import preact from '@preact/preset-vite'
import { dirname, resolve } from 'node:path'
import { baseConfig } from './config.js'
import { slidesPlugin } from './slidesPlugin.js'
import { editorPlugin, BACKUP_DIR } from './editorPlugin.js'

export function createEditorServer(slidesPath, { port = 5173, strictPort = false, open = false } = {}) {
  const abs = resolve(slidesPath)
  const base = baseConfig(abs)
  return createServer({
    ...base,
    plugins: [preact(), slidesPlugin(abs, { editor: true }), editorPlugin(abs)],
    publicDir: dirname(abs),
    server: { ...base.server, host: '127.0.0.1', cors: false, port, strictPort, open: open ? '/editor.html' : false, watch: { ignored: [`**/${BACKUP_DIR}/**`] } },
  })
}
