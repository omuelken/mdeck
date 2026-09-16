// Installs the slide-writing skill for different AI coding assistants. The
// SKILL.md follows the Agent Skills format; adapters wrap the same body for
// tools that use their own file conventions.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { homedir } from 'node:os'
import { frameworkRoot } from '../paths.js'

export const SKILL_FILE = resolve(frameworkRoot, 'skills/write-slides/SKILL.md')

export function readSkill(file = SKILL_FILE) {
  const text = readFileSync(file, 'utf8')
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
  const frontmatter = match?.[1] ?? ''
  const body = match ? text.slice(match[0].length) : text
  const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? 'Write a complete mdeck slide deck.'
  return { text, frontmatter, body, description }
}

const toml = value => `"""${value.replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"')}"""`

// Each target: where the file goes (personal home or the current project) and
// how the shared body is wrapped.
export const TARGETS = {
  claude: { title: 'Claude Code', scope: 'home', path: '.claude/skills/write-slides/SKILL.md', projectPath: '.claude/skills/write-slides/SKILL.md', render: skill => skill.text },
  codex: { title: 'OpenAI Codex', scope: 'home', path: '.codex/skills/write-slides/SKILL.md', projectPath: '.codex/skills/write-slides/SKILL.md', render: skill => skill.text },
  cursor: { title: 'Cursor', scope: 'project', projectPath: '.cursor/rules/write-slides.mdc', render: skill => `---\ndescription: ${skill.description}\nglobs:\nalwaysApply: false\n---\n\n${skill.body}` },
  copilot: { title: 'GitHub Copilot', scope: 'project', projectPath: '.github/prompts/write-slides.prompt.md', render: skill => `---\nmode: agent\ndescription: ${skill.description}\n---\n\n${skill.body}` },
  gemini: { title: 'Gemini CLI', scope: 'project', projectPath: '.gemini/commands/write-slides.toml', render: skill => `description = "${skill.description.replace(/"/g, '\\"')}"\nprompt = ${toml(skill.body + '\n\nRequest: {{args}}\n')}\n` },
}

export function installSkill(target, { project = false, cwd = process.cwd(), home = homedir(), skill = readSkill() } = {}) {
  const spec = TARGETS[target]
  if (!spec) throw new Error(`Unknown assistant "${target}". Choose from: ${Object.keys(TARGETS).join(', ')}`)
  const useProject = project || spec.scope === 'project'
  const file = useProject ? resolve(cwd, spec.projectPath) : resolve(home, spec.path)
  mkdirSync(resolve(file, '..'), { recursive: true })
  writeFileSync(file, spec.render(skill), 'utf8')
  return { target, title: spec.title, file, scope: useProject ? 'project' : 'home' }
}
