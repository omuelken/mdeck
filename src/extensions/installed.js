// Where packs are installed: for every deck (the user's folder, where the
// bundled packs are offered too) or beside one deck. Shared by mdeck themes
// and the design page.
import { existsSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { bundledPacks, loadRegistry, mdeckHome, removedPacks, setRemovedPacks, userExtensionsDir } from './discover.js'
import { installedPacks, installWithRequirements, PackError, removePack } from './packs.js'

// Where a command works: for every deck (the user's folder), or beside a
// deck when one is named or --local is given.
export function target(where, local) {
  if (!where && !local) return { user: true, root: userExtensionsDir(), deck: resolve('slides.md'), label: 'for every deck' }
  const given = resolve(where ?? '.')
  if (!existsSync(given) && !/\.md$/i.test(given)) throw new PackError(`${where} does not exist; name a slides file or the folder it is in`)
  const folder = existsSync(given) && statSync(given).isDirectory() ? given : dirname(given)
  return { user: false, root: resolve(folder, 'extensions'), deck: existsSync(given) && !statSync(given).isDirectory() ? given : resolve(folder, 'slides.md'), label: `in ${resolve(folder, 'extensions')}` }
}

// The packs that `where` has: installed there, and for the user's folder
// also the bundled packs that are offered.
export function packsAt(where) {
  const installed = installedPacks(where.root)
  if (!where.user) return installed
  const offered = Object.fromEntries(Object.keys(bundledPacks()).map(id => [id, { bundled: true, requires: [] }]))
  return { ...offered, ...installed }
}

// The packs at `where` that require `id`.
export function requiredBy(id, where, catalogue) {
  return Object.entries(packsAt(where)).filter(([other, pack]) => {
    if (other === id) return false
    const requires = pack.bundled ? catalogue.packs.find(p => p.id === other)?.requires ?? [] : pack.requires
    return requires.includes(id)
  }).map(([other]) => other)
}

// Installs a pack with what it requires. For every deck, a bundled pack is
// offered again instead of copied.
export async function installHere(catalogue, id, where, { mdeckVersion, force = false }) {
  const removed = removedPacks()
  const has = pack => Object.hasOwn(packsAt(where), pack)
  const bundledHere = where.user ? entry => { setRemovedPacks(removedPacks().filter(other => other !== entry.id)); return true } : null
  const done = await installWithRequirements(catalogue, id, { root: where.root, mdeckVersion, force, has, bundledHere })
  return done.map(step => ({ ...step, wasRemoved: step.bundled && removed.includes(step.id) }))
}

// Removes a pack. For every deck, a bundled pack is hidden (and a newer
// version installed over it removed too); install brings it back.
export function removeHere(catalogue, id, where, { force = false } = {}) {
  const needed = requiredBy(id, where, catalogue)
  if (needed.length && !force) throw new PackError(`${needed.join(', ')} ${needed.length > 1 ? 'require' : 'requires'} ${id}; remove ${needed.length > 1 ? 'them' : 'it'} first, or add --force`)
  const installed = installedPacks(where.root)[id]
  const isBundled = Object.hasOwn(bundledPacks({ all: true }), id)
  if (!installed && !(where.user && isBundled)) throw new PackError(`The pack ${id} is not installed ${where.label}`)
  // Every deck needs a theme: the last one stays, even with --force.
  if (where.user) {
    const themes = Object.values(loadRegistry(resolve(mdeckHome(), 'no-deck', 'slides.md')).themes)
    if (themes.length && themes.every(theme => theme.pack === id)) throw new PackError(`${id} has the last theme installed for every deck (${themes.map(theme => theme.id).join(', ')}); install another theme first, for example mdeck themes install neue`)
  }
  const pack = installed ? removePack(id, { root: where.root, force }) : null
  if (where.user && isBundled) setRemovedPacks([...removedPacks(), id])
  return { folders: pack?.folders ?? [], hidden: where.user && isBundled }
}
