// Every built-in theme, light and dark, on the sample deck: `npm run
// test:themes` (needs Chrome; set MDECK_CHROME if it is not found). The check
// itself is src/build/themeCheck.js.
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadRegistry, manifestsOf } from '../src/extensions/discover.js'
import { checkLooks } from '../src/build/themeCheck.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const themes = Object.keys(manifestsOf(loadRegistry(resolve(root, 'nowhere/slides.md'), { userRoot: null }), 'theme'))
const failures = await checkLooks(themes.map(theme => ({ theme })))
if (failures.length) {
  console.error(`Theme check failed (${failures.length}):\n  ${failures.join('\n  ')}`)
  process.exit(1)
}
console.log(`Theme checks passed: ${themes.join(', ')}, light and dark, every built-in layout.`)
