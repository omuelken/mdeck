// Where a deck's own Preact components come from: its `components/` folder,
// then the folders its `components:` setting lists, in order. Each `*.jsx`
// file's default export is registered under its lowercased file name, so
// `Tokenizer.jsx` becomes `<tokenizer>`. The first folder that has a name wins,
// and all of them override built-ins of the same name.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve, dirname, basename } from 'node:path'
import { parseSlides } from '../core/parseSlides.js'

function expand(path, deckDir) {
  if (path === '~' || path.startsWith('~/')) return resolve(homedir(), path.slice(2))
  return resolve(deckDir, path)
}

// Folder paths as written in the deck, resolved; entries that are not strings
// are left to validateDeck to report.
export function componentFolders(slidesPath, source = readFileSync(slidesPath, 'utf8')) {
  const abs = resolve(slidesPath)
  const deckDir = dirname(abs)
  let listed = []
  try { listed = parseSlides(source).deckConfig?.components ?? [] } catch {}
  return [
    { dir: resolve(deckDir, 'components'), source: 'deck', path: 'components' },
    ...(Array.isArray(listed) ? listed : []).filter(path => typeof path === 'string' && path.trim())
      .map(path => ({ dir: expand(path.trim(), deckDir), source: 'shared', path: path.trim() })),
  ]
}

export function isFolder(dir) {
  try { return statSync(dir).isDirectory() } catch { return false }
}

export function componentFiles(slidesPath, folders = componentFolders(slidesPath)) {
  const seen = new Map()
  for (const folder of folders) {
    if (!existsSync(folder.dir) || !isFolder(folder.dir)) continue
    for (const name of readdirSync(folder.dir).filter(name => /\.jsx$/.test(name)).sort()) {
      const tag = basename(name, '.jsx').toLowerCase()
      if (!seen.has(tag)) seen.set(tag, { tag, file: resolve(folder.dir, name), source: folder.source, folder: folder.path })
    }
  }
  return [...seen.values()]
}
