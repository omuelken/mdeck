import { readFileSync, realpathSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { shareable, resourceKey } from './tunnelClient.js'
import { collectLocalAssetRefs } from './slidesPlugin.js'
import { parseSlides } from '../core/parseSlides.js'
import { sessionCode } from '../live/code.js'

const canonical = file => { try { return realpathSync(file) } catch { return null } }

// Use the entry's import graph, rather than Vite's filesystem allow list.
// Unrelated files and modules that a local editor loaded stay private.
export function createRelayAccess(server, slidesPath) {
  const base = server.config.base
  const root = server.config.root
  const graph = server.environments.client.moduleGraph
  const at = path => `${base}${path.replace(/^\//, '')}`
  const bootstrap = ['main.jsx', '@vite/client', '@vite/env', '@id/__x00__virtual:prefresh']
  const knownFiles = new Map()
  let knownSource = null
  return async (address, method) => {
    let source
    try { source = readFileSync(slidesPath, 'utf8') } catch { return false }
    if (source !== knownSource) { knownFiles.clear(); knownSource = source }
    const resources = new Set(bootstrap.map(path => resourceKey(at(path))))
    const files = new Map()
    const addFile = (file, address) => {
      const real = canonical(file)
      if (!real) return
      if (!knownFiles.has(file)) knownFiles.set(file, real)
      if (knownFiles.get(file) !== real) return
      resources.add(resourceKey(address))
      files.set(resourceKey(address), { file, real })
    }
    const seen = new Set()
    const visit = mod => {
      if (!mod || seen.has(mod)) return
      seen.add(mod)
      const url = mod.url.startsWith(base) ? mod.url : at(mod.url)
      if (mod.file && !mod.id?.startsWith('\0')) addFile(mod.file, url)
      else resources.add(resourceKey(url))
      if (mod.id?.startsWith('\0')) resources.add(resourceKey(at(`@id/__x00__${mod.id.slice(1)}`)))
      for (const child of mod.importedModules) visit(child)
      // Vite rewrites CSS url() references without adding them as JS imports.
      if (mod.file?.endsWith('.css')) {
        let css
        try { css = readFileSync(mod.file, 'utf8') } catch { return }
        for (const match of css.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)) {
          const ref = match[1]
          if (/^(?:[a-z]+:|\/\/|#)/i.test(ref)) continue
          const file = ref.startsWith('/') ? resolve(root, `.${ref}`) : resolve(dirname(mod.file), ref.split(/[?#]/)[0])
          addFile(file, at(`@fs/${file.replace(/^\//, '')}`))
        }
      }
    }
    visit(graph.getModuleById(resolve(root, 'main.jsx')))
    // The HTML-injected Vite client is a second trusted entry point.
    visit(await graph.getModuleByUrl(at('@vite/client')))
    const viteEnv = fileURLToPath(new URL('../client/env.mjs', import.meta.resolve('vite')))
    addFile(viteEnv, at(`@fs/${viteEnv.replace(/^\//, '')}`))
    addFile(resolve(root, 'main.jsx'), at('main.jsx'))
    addFile(resolve(root, 'index.html'), at('index.html'))
    addFile(fileURLToPath(new URL('../client/client.mjs', import.meta.resolve('vite'))), at('@vite/client'))
    for (const ref of collectLocalAssetRefs(source)) {
      // Root-relative assets belong to the deck's public directory.
      const file = resolve(dirname(slidesPath), ref.replace(/^\//, ''))
      const path = ref.replace(/^\.\//, '').replace(/^\//, '')
      addFile(file, at(path))
      addFile(file, at(`@fs/${file.replace(/^\//, '')}`))
    }
    const allowed = shareable(address, method, { base, resources, session: sessionCode(parseSlides(source).deckConfig) })
    if (!allowed) return false
    // Recheck symlinks before forwarding, even if Vite cached an older graph.
    const entry = files.get(resourceKey(address))
    if (entry && canonical(entry.file) !== entry.real) return false
    // Vite serves public files ahead of framework modules. A file beside the
    // deck must not shadow an approved runtime URL and become shareable.
    const path = decodeURIComponent(new URL(address, 'http://localhost').pathname).slice(base.length)
    if (path && !path.startsWith('__mdeck/')) {
      const publicFile = canonical(resolve(dirname(slidesPath), path))
      if (publicFile && publicFile !== entry?.real) return false
    }
    return true
  }
}
