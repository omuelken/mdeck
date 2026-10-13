// Prints the GitHub release notes for a version:
//   node tools/release-notes.mjs 3.10.1
//
// Notes written for the release, in docs/releases/<version>.md, come first:
// they introduce it in headed sections, and the changelog entry stays the
// complete list. Without such a file the changelog entry is the release,
// shaped for reading: an entry with its own `###` sections (and a paragraph
// before them) is used as written; a plain list of changes is put under
// "New and improved" and "Fixed", by whether an entry starts with "Fixed".
// Either way the notes end with how to update and a link to the entry.
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const REPO = 'https://github.com/tilman-schieber/mdeck'

/** The changelog's entry for `version`: { heading, body }, or null. */
export function changelogEntry(changelog, version) {
  const section = changelog.split(/^(?=## )/m).find(s => s.startsWith(`## ${version} `))
  if (!section) return null
  const [heading, ...body] = section.trim().split('\n')
  return { heading, body: body.join('\n').trim() }
}

// The entry as release notes: as written when it has sections, otherwise its
// opening paragraph and its changes grouped into new and fixed.
export function shapeEntry(body) {
  if (/^### /m.test(body)) return body
  const lines = body.split('\n')
  const first = lines.findIndex(line => line.startsWith('- '))
  if (first < 0) return body
  const intro = lines.slice(0, first).join('\n').trim()
  // Each change is a bullet with any lines that continue it.
  const changes = []
  for (const line of lines.slice(first)) {
    if (line.startsWith('- ')) changes.push(line)
    else if (changes.length) changes[changes.length - 1] += `\n${line}`
  }
  const fixed = changes.filter(change => /^- Fixed\b/.test(change))
  const added = changes.filter(change => !fixed.includes(change))
  const parts = [intro]
  // A short entry needs no headings.
  if (!fixed.length || !added.length || changes.length < 4) parts.push(changes.join('\n').trim())
  else parts.push(`### New and improved\n\n${added.join('\n').trim()}`, `### Fixed\n\n${fixed.join('\n').trim()}`)
  return parts.filter(Boolean).join('\n\n')
}

/** The release notes for `version`, or throws when the changelog has no entry. */
export function releaseNotes(version, { changelog, written = null }) {
  const entry = changelogEntry(changelog, version)
  if (!entry) throw new Error(`CHANGELOG.md has no entry for ${version}`)
  const anchor = entry.heading.slice(3).toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s/g, '-')
  const text = written?.trim() || shapeEntry(entry.body)
  const details = written ? 'Every change in detail' : 'Details'
  return `${text}\n\nUpdate with \`npm install -g mdeck\`. ${details} in [CHANGELOG.md](${REPO}/blob/main/CHANGELOG.md#${anchor}).\n`
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = process.argv[2]?.replace(/^v/, '')
  if (!version) {
    console.error('usage: node tools/release-notes.mjs <version>')
    process.exit(1)
  }
  const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8')
  const notes = new URL(`../docs/releases/${version}.md`, import.meta.url)
  try {
    process.stdout.write(releaseNotes(version, { changelog, written: existsSync(notes) ? readFileSync(notes, 'utf8') : null }))
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
