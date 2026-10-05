import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import preact from '@preact/preset-vite'
import { slidesPlugin } from './slidesPlugin.js'
import { frameworkRoot, runtimeRoot } from '../paths.js'
import { componentFolders } from './components.js'

// Resolve preact's entry points through Node so the package's `exports` map is
// honoured — `preact/jsx-dev-runtime` has no directory of its own, so a
// hand-written path alias would break the dev server. Exact-match regexes keep
// `preact` from swallowing its own subpaths.
const PREACT_ENTRIES = [
  'preact',
  'preact/hooks',
  'preact/jsx-runtime',
  'preact/jsx-dev-runtime',
  'preact/compat',
]

function preactAliases() {
  const aliases = []
  for (const spec of PREACT_ENTRIES) {
    let file
    try {
      file = fileURLToPath(import.meta.resolve(spec))
    } catch {
      continue // not installed in this framework copy — skip it
    }
    aliases.push({ find: new RegExp(`^${spec.replace(/\//g, '\\/')}$`), replacement: file })
  }
  return aliases
}

// ── Vite config ───────────────────────────────────────────────────────────────
export function baseConfig(slidesPath, { selfContained = false, defaultView = 'deck', server = null, proxyControls = false } = {}) {
  const abs = resolve(slidesPath)
  return {
    configFile: false,
    root: runtimeRoot,
    plugins: [preact(), slidesPlugin(abs)],
    // Deck-local components live outside the framework root and have no
    // node_modules of their own, so their preact imports must resolve back to
    // the framework's copy — and to the *same* instance, or hooks break.
    resolve: {
      dedupe: ['preact'],
      alias: preactAliases(),
    },
    server: {
      port: 5173,
      strictPort: false,
      fs: { allow: [frameworkRoot, dirname(abs), ...componentFolders(abs).map(folder => folder.dir)] },
    },
    define: {
      __MDECK_SELF_CONTAINED__: JSON.stringify(selfContained),
      __MDECK_DEFAULT_VIEW__: JSON.stringify(defaultView),
      __MDECK_SERVER__: JSON.stringify(server),
      __MDECK_PROXY_CONTROLS__: JSON.stringify(proxyControls),
    },
  }
}
