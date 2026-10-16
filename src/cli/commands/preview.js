// mdeck preview: serves a built folder.
import { preview } from 'vite'
import { existsSync } from 'fs'
import { resolve } from 'path'
import { frameworkRoot } from '../../paths.js'
import { err } from '../ui.js'

export default async function previewFolder({ positionals, hasFlag, portOption, onPort }) {
  const folder = resolve(process.cwd(), positionals()[0] ?? 'dist')
  if (!existsSync(resolve(folder, 'index.html'))) { err(`No built presentation in ${folder}. Make one with mdeck build.`); process.exit(1) }
  const server = await onPort(portOption(), () => preview({
    configFile: false,
    root: frameworkRoot,
    build: { outDir: folder },
    preview: { open: !hasFlag('--no-open'), ...(portOption() ? { port: portOption(), strictPort: true } : {}) },
  }))
  server.printUrls()
}
