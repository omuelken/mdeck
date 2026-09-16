import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { readSkill, installSkill, TARGETS } from '../src/cli/skill.js'

test('the skill follows the Agent Skills format and has no tool-specific placeholders', () => {
  const skill = readSkill()
  assert.match(skill.frontmatter, /^name: write-slides$/m)
  assert.match(skill.frontmatter, /^description: .+/m)
  assert.ok(!skill.body.includes('$ARGUMENTS'))
  assert.ok(skill.body.includes('mdeck templates'))
  assert.ok(skill.body.includes('mdeck check'))
})

test('every assistant gets the same instructions in its own file', () => {
  const home = mkdtempSync(resolve(tmpdir(), 'mdeck-home-'))
  const cwd = mkdtempSync(resolve(tmpdir(), 'mdeck-project-'))
  const skill = readSkill()
  const results = Object.keys(TARGETS).map(target => installSkill(target, { home, cwd, skill }))
  assert.deepEqual(results.map(r => [r.target, r.scope]), [['claude', 'home'], ['codex', 'home'], ['cursor', 'project'], ['copilot', 'project'], ['gemini', 'project']])
  for (const result of results) {
    const text = readFileSync(result.file, 'utf8')
    assert.ok(text.includes('## 2. Quick reference'), result.target)
    assert.ok(text.includes(skill.description), result.target)
  }
  assert.equal(readFileSync(results[0].file, 'utf8'), skill.text)
  assert.match(readFileSync(results[2].file, 'utf8'), /^---\ndescription: .*\nglobs:\nalwaysApply: false\n---/)
  assert.match(readFileSync(results[3].file, 'utf8'), /^---\nmode: agent/)
  assert.match(readFileSync(results[4].file, 'utf8'), /^description = ".*"\nprompt = """/)
  assert.match(readFileSync(results[4].file, 'utf8'), /\{\{args\}\}/)
  assert.equal(installSkill('claude', { home, cwd, skill, project: true }).file, resolve(cwd, '.claude/skills/write-slides/SKILL.md'))
  assert.throws(() => installSkill('vim', { home, cwd, skill }), /Unknown assistant/)
})
