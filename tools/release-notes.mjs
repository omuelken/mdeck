// Prints the GitHub release notes for a version from its CHANGELOG.md entry:
//   node tools/release-notes.mjs 3.10.1
import { readFileSync } from 'node:fs'

const version = process.argv[2]?.replace(/^v/, '')
if (!version) {
  console.error('usage: node tools/release-notes.mjs <version>')
  process.exit(1)
}

const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8')
const sections = changelog.split(/^(?=## )/m)
const section = sections.find((s) => s.startsWith(`## ${version} `))
if (!section) {
  console.error(`CHANGELOG.md has no entry for ${version}`)
  process.exit(1)
}

const [heading, ...body] = section.trim().split('\n')
const anchor = heading
  .slice(3)
  .toLowerCase()
  .replace(/[^\w\s-]/g, '')
  .replace(/\s/g, '-')

console.log(`${body.join('\n').trim()}

Update with \`npm install -g mdeck\`. Details in [CHANGELOG.md](https://github.com/tilman-schieber/mdeck/blob/main/CHANGELOG.md#${anchor}).`)
