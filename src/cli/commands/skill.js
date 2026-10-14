// mdeck skill: the slide-writing skill for AI assistants.
import { installSkill, readSkill, TARGETS } from '../skill.js'
import { c, ok, err } from '../ui.js'

export default async function skill({ options, hasFlag }) {
  const installIndex = options['--install'] ? 0 : -1
  if (hasFlag('--print') || installIndex < 0) {
    if (installIndex < 0 && !hasFlag('--print')) {
      console.log(`\n  The write-slides skill drafts a complete deck for an AI coding assistant.\n`)
      for (const [key, spec] of Object.entries(TARGETS)) console.log(`    ${c.cyan}${key.padEnd(8)}${c.reset} ${spec.title.padEnd(16)} ${c.dim}${spec.scope === 'home' ? `~/${spec.path}  (or --project)` : spec.projectPath}${c.reset}`)
      console.log(`\n  ${c.dim}mdeck skill --install claude codex     install for one or more assistants\n  mdeck skill --print                     print the skill for any other tool${c.reset}\n`)
    } else process.stdout.write(readSkill().text)
  } else {
    const targets = options['--install']
    if (!targets.length) { err(`Name at least one assistant: ${Object.keys(TARGETS).join(', ')}`); process.exit(1) }
    for (const target of targets) {
      try { const result = installSkill(target, { project: hasFlag('--project') }); ok(`${result.title}: ${c.cyan}${result.file}${c.reset}`) } catch (error) { err(error.message); process.exitCode = 1 }
    }
  }
}
