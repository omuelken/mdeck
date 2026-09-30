// Files mdeck itself just wrote while the dev server runs, so the watcher can
// tell its own writes (a new slide id, saved ink) from edits by the author:
// its own writes must not reload the open windows in the middle of a talk.
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

const written = new Map()
const hash = content => createHash('sha1').update(content).digest('hex')

export function markOwnWrite(path, content) {
  written.set(resolve(path), hash(content))
}

// True when `content` is what mdeck last wrote to `path`. The mark stays, as
// watchers may report one write twice; the same content needs no reload.
export function isOwnWrite(path, content) {
  return written.get(resolve(path)) === hash(content)
}
