// mdeck list: the layouts, themes, palettes and dataviews a deck can use.
import { manifestsOf, serializeRegistry } from '../../extensions/discover.js'
import { KINDS } from '../../extensions/manifest.js'
import { paramKind } from '../../extensions/params.js'
import { c, err, tip } from '../ui.js'

export default async function list({ positionals, hasFlag, registryFor }) {
  const KIND_WORDS = { layouts: 'layout', themes: 'theme', palettes: 'palette', dataviews: 'dataview' }
  const [first, ...others] = positionals()
  const word = Object.hasOwn(KIND_WORDS, first) ? first : null
  if (first && !word && !/\.md$/i.test(first)) { err(`Unknown kind: ${first}`); tip('Use layouts, themes, palettes or dataviews.'); process.exit(1) }
  const file = (word ? others[0] : first) ?? 'slides.md'
  const registry = registryFor(file)
  if (hasFlag('--json')) {
    console.log(JSON.stringify(word ? manifestsOf(registry, KIND_WORDS[word]) : serializeRegistry(registry, { relativeTo: process.cwd() }), null, 2))
  } else for (const kind of KINDS) {
    if (word && KIND_WORDS[word] !== kind) continue
    console.log(`\n  ${c.bold}${kind}s${c.reset}`)
    for (const record of Object.values(registry[`${kind}s`])) {
      console.log(`    ${c.cyan}${record.id}${c.reset} — ${record.title} ${c.dim}(${record.source})${record.description ? ' ' + record.description : ''}${c.reset}`)
      // What a theme suits, from its guide; --json has the whole guide.
      if (record.manifest?.guide?.suits) console.log(`      ${c.dim}Suits: ${record.manifest.guide.suits.join(' · ')}${c.reset}`)
      // The settings a deck may change under params:, with the kind of value each takes.
      const params = Object.entries(record.manifest?.params ?? {})
      if (params.length) console.log(`      ${c.dim}Settings: ${params.map(([name, param]) => name + paramKind(param)).join(' · ')}${c.reset}`)
      // A dataview's options are attributes of the <data> tag.
      const options = Object.entries(record.manifest?.properties ?? {})
      if (options.length) console.log(`      ${c.dim}Options: ${options.map(([name, schema]) => `${name} (${schema.enum ? schema.enum.join(', ') : schema.type})`).join(' · ')}${c.reset}`)
    }
  }
}
