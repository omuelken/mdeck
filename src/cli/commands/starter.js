// mdeck starter: the starter Markdown of a layout.
import { manifestsOf } from '../../extensions/discover.js'
import { err, tip } from '../ui.js'

export default async function starter({ positionals, registryFor }) {
  const [name, file = 'slides.md'] = positionals()
  if (!name) { err('Name a layout.'); tip('Usage: mdeck starter <layout> [slides.md]; mdeck list layouts shows the names.'); process.exit(1) }
  const layouts = manifestsOf(registryFor(file), 'layout')
  if (!Object.hasOwn(layouts, name)) { err(`Unknown layout: ${name}`); process.exitCode = 1 }
  else process.stdout.write(layouts[name].starter)
}
