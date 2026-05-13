import { readFileSync } from 'fs'
import { resolve } from 'path'

const VIRTUAL_ID = 'virtual:slides'
const RESOLVED_ID = '\0virtual:slides'

export function slidesPlugin(slidesPath) {
  const abs = resolve(slidesPath)

  return {
    name: 'vite-plugin-slides',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID
    },
    load(id) {
      if (id === RESOLVED_ID) {
        return `export default ${JSON.stringify(readFileSync(abs, 'utf-8'))}`
      }
    },
    handleHotUpdate({ file, server }) {
      if (resolve(file) === abs) {
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
        if (mod) server.moduleGraph.invalidateModule(mod)
        server.ws.send({ type: 'full-reload' })
      }
    },
  }
}
