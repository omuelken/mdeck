// `mdeck themes`: themes and palettes from the theme repository. Installs go
// into a deck's extensions/ folder, or with --global into the user's
// (~/.mdeck/extensions), where every deck finds them. `build` is for the
// repository itself: it checks the packs and writes what is served.
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { builtInRegistry, loadRegistry, userExtensionsDir } from '../extensions/discover.js'
import { ManifestError } from '../extensions/manifest.js'
import { buildRepository, compareVersions, fetchIndex, findPack, installedPacks, installFromIndex, PackError, removePack } from '../extensions/packs.js'

const VERSION = createRequire(import.meta.url)('../../package.json').version

const USAGE = 'search [words] | install <pack> | remove <pack> | update [pack] | list, each with [slides.md or folder] and --global; build <packs> -o <out> [--check]'

// The built-in themes and palettes a pack may name and must not reuse the ids of.
const builtIns = () => {
  const registry = builtInRegistry()
  return { themes: registry.themes, palettes: registry.palettes }
}

// The extensions folder a command works on, and a slides path to load the
// registry with: the user's with --global, else beside the deck or in the folder.
function target(where, global) {
  if (global) return { root: userExtensionsDir(), deck: resolve('slides.md'), label: 'for every deck' }
  const given = resolve(where ?? '.')
  const folder = existsSync(given) && statSync(given).isDirectory() ? given : dirname(given)
  return { root: resolve(folder, 'extensions'), deck: existsSync(given) && !statSync(given).isDirectory() ? given : resolve(folder, 'slides.md'), label: `in ${resolve(folder, 'extensions')}` }
}

const install = (index, entry, { root, force }) => installFromIndex(index, entry, { root, known: builtIns(), mdeckVersion: VERSION, force })

export async function runThemes({ positionals, flag, output, ui: { ok, err, tip, c } }) {
  const [sub = 'search', ...rest] = positionals
  const global = flag('--global'), force = flag('--force')
  try {
    if (sub === 'search') {
      const index = await fetchIndex()
      const words = rest.map(word => word.toLowerCase())
      const local = installedPacks(target(null, false).root), mine = installedPacks(userExtensionsDir())
      const found = index.packs.filter(pack => words.every(word => [pack.id, pack.title, pack.description, ...pack.themes, ...pack.palettes].join(' ').toLowerCase().includes(word)))
      if (!found.length) return tip(`No pack matches${words.length ? ` "${words.join(' ')}"` : ''} in ${index.url}`)
      for (const pack of found) {
        const have = local[pack.id] ?? mine[pack.id]
        const state = !have ? '' : compareVersions(pack.version, have.version) > 0 ? ` ${c.yellow}(${have.version} installed, update available)${c.reset}` : ` ${c.green}(installed)${c.reset}`
        console.log(`\n  ${c.cyan}${pack.id}${c.reset} ${pack.version} — ${pack.title}${state}`)
        if (pack.description) console.log(`    ${pack.description}`)
        console.log(`    ${c.dim}${[pack.themes.length ? `themes: ${pack.themes.join(', ')}` : '', pack.palettes.length ? `palettes: ${pack.palettes.join(', ')}` : ''].filter(Boolean).join(' · ')} · by ${pack.author}, ${pack.license}${c.reset}`)
      }
      console.log()
      return tip('Install one with: mdeck themes install <pack> [slides.md]   (--global for every deck)')
    }

    if (sub === 'install') {
      const [id, where] = rest
      if (!id) { err('Name a pack.'); return tip('Usage: mdeck themes install <pack> [slides.md or folder] [--global]; mdeck themes search lists them.') }
      const { root, deck, label } = target(where, global)
      const index = await fetchIndex()
      const result = await install(index, findPack(index, id), { root, force })
      loadRegistry(deck)
      ok(`${result.replaced ? `Updated ${id} from ${result.replaced}` : `Installed ${id}`} ${label}`)
      if (result.themes.length) tip(`Themes: ${result.themes.join(', ')}. Use one with "theme: ${result.themes[0]}" in the deck settings.`)
      if (result.palettes.length) tip(`Palettes: ${result.palettes.join(', ')}. Use one with "palette: ${result.palettes[0]}".`)
      return tip('Look at it on a sample deck: mdeck design')
    }

    if (sub === 'remove') {
      const [id, where] = rest
      if (!id) { err('Name a pack.'); return tip('Usage: mdeck themes remove <pack> [slides.md or folder] [--global]') }
      const { root, label } = target(where, global)
      const pack = removePack(id, { root, force })
      return ok(`Removed ${id} ${label} (${pack.folders.join(', ')})`)
    }

    if (sub === 'update') {
      const [first, second] = rest
      const named = first && !/\.md$/i.test(first) && !(existsSync(first) && statSync(first).isDirectory()) ? first : null
      const { root, deck, label } = target(named ? second : first, global)
      const installed = installedPacks(root)
      const ids = named ? [named] : Object.keys(installed)
      if (!ids.length) return tip(`No packs installed ${label}`)
      const index = await fetchIndex()
      for (const id of ids) {
        if (!installed[id]) throw new PackError(`The pack ${id} is not installed ${label}`)
        const entry = findPack(index, id)
        if (compareVersions(entry.version, installed[id].version) <= 0) { tip(`${id} ${installed[id].version} is up to date`); continue }
        await install(index, entry, { root, force })
        ok(`Updated ${id} ${installed[id].version} → ${entry.version}`)
      }
      loadRegistry(deck)
      return
    }

    if (sub === 'list') {
      const [where] = rest
      for (const [label, root] of [['This folder', target(where, false).root], ['Every deck (--global)', userExtensionsDir()]]) {
        const packs = installedPacks(root)
        console.log(`\n  ${c.bold}${label}${c.reset} ${c.dim}${root}${c.reset}`)
        if (!Object.keys(packs).length) console.log(`    ${c.dim}none${c.reset}`)
        for (const [id, pack] of Object.entries(packs)) console.log(`    ${c.cyan}${id}${c.reset} ${pack.version} — ${pack.folders.join(', ')}`)
      }
      console.log()
      return
    }

    if (sub === 'build') {
      const [packsDir] = rest
      const out = output()
      if (!packsDir || !out) { err('Name the packs folder and the output folder.'); return tip('Usage: mdeck themes build <packs folder> -o <output folder> [--check]') }
      const index = buildRepository(resolve(packsDir), resolve(out), { known: builtIns() })
      // Every theme and palette of every pack, from the pack folders.
      const extensions = Object.fromEntries(index.packs.flatMap(pack => [...pack.themes, ...pack.palettes].map(id => [id, resolve(packsDir, pack.id, id)])))
      const paletteTheme = id => {
        const text = readFileSync(resolve(extensions[id], 'extension.toml'), 'utf8')
        return /^theme\s*=\s*"([^"]+)"/m.exec(text)?.[1] ?? 'neue'
      }
      const { checkLooks, renderPreviews } = await import('../build/themeCheck.js')
      const looks = index.packs.flatMap(pack => [...pack.themes.map(theme => ({ id: theme, theme })), ...pack.palettes.map(palette => ({ id: palette, theme: paletteTheme(palette), palette }))])
      if (flag('--check')) {
        const failures = await checkLooks(looks, { extensions })
        if (failures.length) { err(`The theme check found ${failures.length} problem(s):`); for (const line of failures) console.error(`    ${line}`); process.exitCode = 1; return }
        ok(`Checked ${looks.map(look => look.id).join(', ')}, light and dark, on every kind of slide`)
      }
      // Themes on the title slide, palettes on the chapter slide (the third).
      await renderPreviews(looks.map(look => ({ file: resolve(out, 'previews', `${look.id}.webp`), theme: look.theme, palette: look.palette ?? '', slide: look.palette ? 3 : 1 })), { extensions })
      for (const pack of index.packs) pack.previews = Object.fromEntries([...pack.themes, ...pack.palettes].map(id => [id, `previews/${id}.webp`]))
      writeFileSync(resolve(out, 'index.json'), JSON.stringify(index, null, 2) + '\n')
      return ok(`Built ${index.packs.length} pack(s) into ${resolve(out)}`)
    }

    err(`Unknown: mdeck themes ${sub}`)
    tip(`Use: mdeck themes ${USAGE}`)
    process.exitCode = 1
  } catch (error) {
    if (!(error instanceof PackError || error instanceof ManifestError)) throw error
    err(error.message)
    process.exitCode = 1
  }
}

