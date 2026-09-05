import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

// Files installed with mdeck are located relative to this module, never cwd.
export const frameworkRoot = fileURLToPath(new URL('../', import.meta.url))
export const runtimeRoot = resolve(frameworkRoot, 'src/runtime')
export const assetsRoot = resolve(frameworkRoot, 'assets')
export const docsRoot = resolve(frameworkRoot, 'docs/site')
