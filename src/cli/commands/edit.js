// mdeck edit: forms and a live preview, saving into the file.
import { resolve } from 'path'
import { BACKUP_DIR } from '../../build/editorPlugin.js'
import { createEditorServer } from '../../build/editorServer.js'
import { c, ok, tip } from '../ui.js'

export default async function edit({ hasFlag, portOption, requireInput, registryFor, onPort }) {
  const input = requireInput('edit')
  const abs = resolve(input)
  registryFor(input)
  const port = portOption()
  const server = await createEditorServer(abs, { port: port ?? 5173, strictPort: !!port, open: !hasFlag('--no-open') })
  await onPort(port, () => server.listen())
  server.printUrls()
  console.log()
  ok(`Editing ${c.cyan}${abs}${c.reset}`)
  tip(`Changes are saved to the file as you type. Before the first change, a copy goes to ${BACKUP_DIR}/ beside it.\n`)
}
