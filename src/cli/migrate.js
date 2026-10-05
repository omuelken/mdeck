import { existsSync, readFileSync, readdirSync, writeFileSync, renameSync, copyFileSync, mkdirSync, unlinkSync, constants } from 'node:fs'
import { resolve, dirname, basename, relative } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { parseSync } from 'vite'
import { parseSlides, isPlainObject } from '../core/parseSlides.js'
import { setDeckConfig } from '../core/editDeck.js'
import { applySourceEdits } from '../core/source.js'
import { inkFileFor, oldInkFileFor } from '../core/ink.js'
import { parseManifestText, validateManifest, MANIFEST_FILENAME } from '../extensions/manifest.js'
import { BACKUP_DIR } from '../build/editorPlugin.js'

function migratedSource(source) {
  const deck = parseSlides(source), config = deck.deckConfig, patch = {}
  if (deck.diagnostics.some(d => d.severity === 'error')) throw new Error('Fix source parsing errors before migrating the deck')
  const set = (key, value) => {
    if (Object.hasOwn(config, key) && !isDeepStrictEqual(config[key], value)) throw new Error(`Migration conflict: ${key} already has a different value`)
    patch[key] = value
  }
  for (const [old, key] of [['design', 'theme'], ['share', 'reader']]) {
    if (Object.hasOwn(config, old)) { set(key, config[old]); patch[old] = undefined }
  }
  const show = { ...(config.show ?? {}) }
  for (const [old, key] of [['institution', 'organization'], ['authorDate', 'author'], ['pageNumbers', 'numbers'], ['sections', 'sections']]) {
    if (!Object.hasOwn(config, old)) continue
    if (config.show != null && !isPlainObject(config.show)) throw new Error('Migration conflict: show is not a mapping')
    if (Object.hasOwn(show, key) && !isDeepStrictEqual(show[key], config[old])) throw new Error(`Migration conflict: show.${key} already has a different value`)
    show[key] = config[old]; patch[old] = undefined; patch.show = show
  }
  if (Object.hasOwn(config, 'live')) {
    const live = config.live
    if (!isPlainObject(live) || Object.keys(live).some(key => !['server', 'id', 'code'].includes(key))) throw new Error('Cannot migrate live: expected a mapping containing server, id and/or code')
    if (Object.hasOwn(live, 'server')) set('server', live.server)
    const session = { ...(config.session ?? {}) }
    if (config.session != null && !isPlainObject(config.session)) throw new Error('Migration conflict: session is not a mapping')
    for (const key of ['id', 'code']) {
      if (!Object.hasOwn(live, key)) continue
      if (Object.hasOwn(session, key) && !isDeepStrictEqual(session[key], live[key])) throw new Error(`Migration conflict: session.${key} already has a different value`)
      session[key] = live[key]; patch.session = session
    }
    patch.live = undefined
  }
  return Object.keys(patch).length ? setDeckConfig(deck, patch) : source
}

function* walk(dir) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const file = resolve(dir, entry.name)
    if (entry.isDirectory()) yield* walk(file)
    else if (entry.isFile()) yield file
  }
}

function migratedImports(file, source) {
  if (!source.includes('mdeck/template-api')) return source
  const parsed = parseSync(file, source)
  if (parsed.errors.length) throw new Error(`Cannot parse ${file}; fix its code before migrating imports`)
  const edits = []
  const visit = node => {
    if (!node || typeof node !== 'object') return
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(node.type) && node.source?.value === 'mdeck/template-api') edits.push({ start: node.source.start + 1, end: node.source.end - 1, text: 'mdeck/layout' })
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit)
      else if (value && typeof value === 'object') visit(value)
    }
  }
  visit(parsed.program)
  return applySourceEdits(source, edits)
}

// Plan every change and check conflicts before writing. Backups and rollback
// keep both source edits and file renames reversible; a dry run writes nothing.
export function migrateDeck(slidesPath, { dryRun = false } = {}) {
  const abs = resolve(slidesPath), dir = dirname(abs), changes = []
  const edit = (file, transform) => {
    const before = readFileSync(file, 'utf8'), after = transform(before)
    if (before !== after) changes.push({ file, before, after })
  }
  edit(abs, migratedSource)
  for (const file of walk(resolve(dir, 'extensions'))) {
    if (basename(file) === MANIFEST_FILENAME) edit(file, source => {
      const raw = parseManifestText(source, file)
      if (raw.kind !== 'template') return source
      validateManifest({ ...raw, kind: 'layout' }, { file, dir: dirname(file), folderName: basename(dirname(file)) })
      // Only the value changes. Comments, quoting and CRLF stay intact.
      const after = source.replace(/^(\s*(?:kind|"kind"|'kind')\s*=\s*)(["'])template\2/gm, '$1$2layout$2')
      const expected = Object.assign(Object.create(Object.getPrototypeOf(raw)), raw, { kind: 'layout' })
      if (after === source || !isDeepStrictEqual(parseManifestText(after, file), expected)) throw new Error(`Cannot safely rewrite kind in ${file}; set kind = "layout" manually`)
      return after
    })
    else if (/\.[cm]?[jt]sx?$/.test(file)) edit(file, source => migratedImports(file, source))
  }
  for (const file of walk(resolve(dir, 'components'))) if (/\.[cm]?[jt]sx?$/.test(file)) edit(file, source => migratedImports(file, source))
  const old = oldInkFileFor(abs), target = inkFileFor(abs)
  if (existsSync(old)) {
    if (existsSync(target)) throw new Error(`Migration conflict: both ${basename(old)} and ${basename(target)} exist. Resolve the two drawings files first.`)
    changes.push({ file: old, to: target })
  }
  if (dryRun || !changes.length) return changes
  const backup = resolve(dir, BACKUP_DIR, `migration-${Date.now()}-${process.pid}`)
  mkdirSync(backup, { recursive: true })
  for (const change of changes) {
    const saved = resolve(backup, relative(dir, change.file))
    mkdirSync(dirname(saved), { recursive: true })
    copyFileSync(change.file, saved)
  }
  const applied = []
  try {
    for (const change of changes) {
      if (change.to) { copyFileSync(change.file, change.to, constants.COPYFILE_EXCL); try { unlinkSync(change.file) } catch (error) { unlinkSync(change.to); throw error } }
      else writeFileSync(change.file, change.after, 'utf8')
      applied.push(change)
    }
  } catch (error) {
    for (const change of applied.reverse()) {
      if (change.to) renameSync(change.to, change.file)
      else writeFileSync(change.file, change.before, 'utf8')
    }
    throw error
  }
  return changes
}
