// Where themes and palettes are installed: for every deck (the user's
// folder, where the built-in ones are offered too) or beside one deck.
// Shared by mdeck themes / mdeck palettes and the design page.
import { existsSync, rmSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { loadRegistry, mdeckHome, removedBuiltIns, setRemovedBuiltIns, userExtensionsDir } from './discover.js'
import { installedPackages, installPackage, keyOf, obtainPackage, PackageError, removePackage, satisfies, withDependencies } from './packages.js'

const fail = message => { throw new PackageError(message) }

// Where a command works: for every deck (the user's folder), or beside a
// deck when one is named or --local is given.
export function target(where, local) {
  if (!where && !local) return { user: true, root: userExtensionsDir(), deck: resolve(mdeckHome(), 'no-deck', 'slides.md'), label: 'for every deck' }
  const given = resolve(where ?? '.')
  if (!existsSync(given) && !/\.md$/i.test(given)) fail(`${where} does not exist; name a slides file or the folder it is in`)
  const folder = existsSync(given) && statSync(given).isDirectory() ? given : dirname(given)
  return { user: false, root: resolve(folder, 'extensions'), deck: existsSync(given) && !statSync(given).isDirectory() ? given : resolve(folder, 'slides.md'), label: `in ${resolve(folder, 'extensions')}` }
}

// The themes and palettes `where` sees, as a registry: for every deck what
// this user has, beside a deck also what that deck has.
const registryAt = where => loadRegistry(where.deck)

// Installs a theme or palette with what it needs. What `where` has already
// stays as it is. A built-in one is not copied: for every deck it is offered
// again if it was removed. A theme and its own palette may need each other,
// so the registry is checked before anything is written and once all is
// there; if anything fails, what this call installed is taken out again.
export async function installHere(catalogue, kind, id, where, { mdeckVersion, force = false }) {
  const before = registryAt(where)
  const plan = withDependencies(catalogue, kind, id)
  const done = [], written = []
  try {
    for (const entry of plan) {
      const key = keyOf(entry.kind, entry.id)
      const requested = entry.kind === kind && entry.id === id
      if (entry.builtIn) {
        const hidden = removedBuiltIns()
        const wasRemoved = hidden.includes(key)
        if (wasRemoved) setRemovedBuiltIns(hidden.filter(other => other !== key))
        done.push({ kind: entry.kind, id: entry.id, version: entry.version, builtIn: true, wasRemoved, requested })
        continue
      }
      const have = installedPackages(where.root)[key]
      // Beside a deck, what is installed only for every deck is copied too,
      // so the slide folder carries it.
      const there = before[`${entry.kind}s`][entry.id]
      if (!requested && (have || (there && (where.user || there.source !== 'user')))) { done.push({ kind: entry.kind, id: entry.id, version: have?.version ?? null, kept: true, requested }); continue }
      if (!satisfies(entry.mdeck, mdeckVersion)) fail(`The ${entry.kind} ${entry.id} ${entry.version} needs mdeck ${entry.mdeck}; this is ${mdeckVersion}. Update mdeck first: npm install -g mdeck`)
      const { bundle, url, digest } = await obtainPackage(catalogue, entry)
      const result = installPackage(bundle, { root: where.root, url, digest, force })
      if (!result.replaced) written.push(result.dir)
      done.push({ kind: entry.kind, id: entry.id, version: entry.version, replaced: result.replaced, requested })
    }
    registryAt(where)
  } catch (error) {
    for (const dir of written) rmSync(dir, { recursive: true, force: true })
    throw error
  }
  return done
}

// Removes a theme or palette. A built-in one is hidden instead, for every
// deck; installing it brings it back. A palette a theme here uses by default
// stays; a theme takes the palettes that belong only to it along; the last
// theme stays.
export function removeHere(kind, id, where, { force = false } = {}) {
  const registry = registryAt(where)
  const record = registry[`${kind}s`][id]
  const installed = installedPackages(where.root)
  const key = keyOf(kind, id)
  if (!installed[key] && !(where.user && record?.source === 'built-in')) fail(`The ${kind} ${id} is not installed ${where.label}`)
  if (kind === 'palette') {
    const users = Object.values(registry.themes).filter(theme => theme.manifest.palette === id).map(theme => theme.id)
    if (users.length) fail(`${users.join(', ')} ${users.length > 1 ? 'use' : 'uses'} the palette ${id} by default; remove ${users.length > 1 ? 'those themes' : 'that theme'} first`)
  }
  if (kind === 'theme' && Object.keys(registry.themes).length === 1) fail(`${id} is the last theme ${where.label}; install another theme first (mdeck themes search lists them)`)
  const removed = []
  const take = (k, i) => {
    const r = registry[`${k}s`][i]
    if (installedPackages(where.root)[keyOf(k, i)]) { removePackage(k, i, { root: where.root, force }); removed.push({ kind: k, id: i }) }
    else if (where.user && r?.source === 'built-in') { setRemovedBuiltIns([...removedBuiltIns(), keyOf(k, i)]); removed.push({ kind: k, id: i, hidden: true }) }
  }
  take(kind, id)
  if (kind === 'theme') for (const palette of Object.values(registry.palettes)) if (palette.manifest.theme === id) take('palette', palette.id)
  return removed
}
