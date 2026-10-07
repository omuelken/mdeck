// `mdeck themes`: every theme and palette comes in a pack. Some packs come
// with mdeck (the starter set), the others from the theme repository.
// Packs are installed for every deck (~/.mdeck/extensions) unless a deck or
// folder is named, or --local is given: then into the extensions folder
// beside it, so the slide folder carries them. A pack that comes with mdeck
// is removed by hiding it, and installed again from mdeck's own copy, so
// that works offline. `build` is for the repository itself.
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { bundledPacks, loadRegistry, manifestsOf, removedPacks, userExtensionsDir } from '../extensions/discover.js'
import { target, packsAt, installHere, removeHere } from '../extensions/installed.js'
import { palettesFor } from '../extensions/tokens.js'
import { ManifestError } from '../extensions/manifest.js'
import { buildRepository, compareVersions, findPack, installedPacks, installWithRequirements, loadCatalogue, PackError } from '../extensions/packs.js'

const VERSION = createRequire(import.meta.url)('../../package.json').version

const USAGE = 'search [words] | install <pack> | remove <pack> | update [pack] | list — for every deck, or beside a deck with [slides.md or folder] or --local; build <packs> -o <out> [--check]'

// Every theme with the palettes it offers, and every palette's colours, each
// marked with its pack and whether it comes with mdeck.
function looksOf(registry, index) {
  const packOf = Object.fromEntries(index.packs.flatMap(p => [...p.themes, ...p.palettes].map(id => [id, p])))
  const palettes = manifestsOf(registry, 'palette')
  const colours = tokens => Object.fromEntries(['--bg', '--surface', '--ink', '--accent', '--accent-2'].map(key => [key, tokens?.[key] ?? null]))
  const origin = id => ({ pack: packOf[id]?.id ?? null, bundled: Boolean(packOf[id]?.bundled) })
  return {
    mdeck: VERSION,
    themes: Object.values(manifestsOf(registry, 'theme')).map(theme => ({ id: theme.id, title: theme.title, description: theme.description ?? '', ...origin(theme.id),
      palette: theme.palette, appearance: theme.appearance ?? 'light', palettes: palettesFor(theme, palettes).map(p => p.id) })),
    palettes: Object.values(palettes).map(palette => ({ id: palette.id, title: palette.title, description: palette.description ?? '', ...origin(palette.id),
      light: colours(palette.light), dark: colours(palette.dark) })),
  }
}

export async function runThemes({ positionals, flag, output, ui: { ok, err, tip, c } }) {
  const [sub = 'search', ...rest] = positionals
  const local = flag('--local'), force = flag('--force')
  const warnOffline = catalogue => { if (catalogue.offline) tip(`The theme repository could not be reached (${catalogue.offline}); showing the packs that come with mdeck.`) }
  const what = step => [step.themes?.length ? `themes ${step.themes.join(', ')}` : '', step.palettes?.length ? `palettes ${step.palettes.join(', ')}` : ''].filter(Boolean).join('; ')
  try {
    if (sub === 'search') {
      const catalogue = await loadCatalogue({ bundled: bundledPacks({ all: true }) })
      warnOffline(catalogue)
      const words = rest.map(word => word.toLowerCase())
      const mine = packsAt(target(null, false)), here = installedPacks(target('.', true).root), hidden = removedPacks()
      const found = catalogue.packs.filter(pack => words.every(word => [pack.id, pack.title, pack.description, ...pack.themes, ...pack.palettes].join(' ').toLowerCase().includes(word)))
      if (!found.length) return tip(`No pack matches${words.length ? ` "${words.join(' ')}"` : ''}`)
      for (const pack of found) {
        const have = here[pack.id] ?? mine[pack.id]
        const state = hidden.includes(pack.id) && !have ? ` ${c.dim}(comes with mdeck, removed)${c.reset}`
          : !have ? (pack.bundled || pack.bundledVersion ? ` ${c.dim}(comes with mdeck)${c.reset}` : '')
          : have.bundled ? (pack.bundled ? ` ${c.green}(comes with mdeck)${c.reset}` : ` ${c.yellow}(comes with mdeck as ${pack.bundledVersion}, update available)${c.reset}`)
          : compareVersions(pack.version, have.version) > 0 ? ` ${c.yellow}(${have.version} installed, update available)${c.reset}` : ` ${c.green}(installed)${c.reset}`
        console.log(`\n  ${c.cyan}${pack.id}${c.reset} ${pack.version} — ${pack.title}${state}`)
        if (pack.description) console.log(`    ${pack.description}`)
        console.log(`    ${c.dim}${[pack.themes.length ? `themes: ${pack.themes.join(', ')}` : '', pack.palettes.length ? `palettes: ${pack.palettes.join(', ')}` : '', pack.requires?.length ? `requires: ${pack.requires.join(', ')}` : ''].filter(Boolean).join(' · ')} · by ${pack.author}, ${pack.license}${c.reset}`)
      }
      console.log()
      return tip('Install one for every deck with: mdeck themes install <pack>   (beside a deck: add slides.md or --local)')
    }

    if (sub === 'install') {
      const [id, where] = rest
      if (!id) { err('Name a pack.'); return tip('Usage: mdeck themes install <pack> [slides.md or folder] [--local]; mdeck themes search lists them.') }
      const at = target(where, local)
      const catalogue = await loadCatalogue({ bundled: bundledPacks({ all: true }) })
      warnOffline(catalogue)
      findPack(catalogue, id)
      for (const step of await installHere(catalogue, id, at, { mdeckVersion: VERSION, force })) {
        if (step.kept) tip(`${step.id} ${step.version} is there already`)
        else if (step.bundled) (step.wasRemoved ? ok(`${step.id} comes with mdeck and is offered again ${at.label}`) : tip(`${step.id} comes with mdeck and is installed ${at.label} already`))
        else ok(`${step.replaced ? `Updated ${step.id} from ${step.replaced} to ${step.version}` : `Installed ${step.id} ${step.version}`} ${at.label}${what(step) ? `: ${what(step)}` : ''}`)
      }
      loadRegistry(at.deck)
      const pack = findPack(catalogue, id)
      if (pack.themes.length) tip(`Use it with "theme: ${pack.themes[0]}" at the top of a slide file.`)
      else if (pack.palettes.length) tip(`Use it with "palette: ${pack.palettes[0]}" at the top of a slide file.`)
      return tip('Look at it on a sample deck: mdeck design')
    }

    if (sub === 'remove') {
      const [id, where] = rest
      if (!id) { err('Name a pack.'); return tip('Usage: mdeck themes remove <pack> [slides.md or folder] [--local]') }
      const at = target(where, local)
      const catalogue = await loadCatalogue({ bundled: bundledPacks({ all: true }), online: false })
      const removed = removeHere(catalogue, id, at, { force })
      if (removed.folders.length) ok(`Removed ${id} ${at.label} (${removed.folders.join(', ')})`)
      if (removed.hidden) ok(`${id} comes with mdeck and is no longer offered; mdeck themes install ${id} brings it back`)
      return
    }

    if (sub === 'update') {
      const [first, second] = rest
      const named = first && !/\.md$/i.test(first) && !(existsSync(first) && statSync(first).isDirectory()) ? first : null
      const at = target(named ? second : first, local)
      const catalogue = await loadCatalogue({ bundled: bundledPacks({ all: true }) })
      warnOffline(catalogue)
      const installed = packsAt(at)
      const ids = named ? [named] : Object.keys(installed)
      if (!ids.length) return tip(`No packs installed ${at.label}`)
      for (const id of ids) {
        const have = installed[id]
        if (!have) throw new PackError(`The pack ${id} is not installed ${at.label}`)
        const entry = findPack(catalogue, id)
        // A bundled pack is up to date until the repository has a newer one.
        if (have.bundled ? entry.bundled : compareVersions(entry.version, have.version) <= 0) { tip(`${id} ${have.version ?? entry.version} is up to date`); continue }
        const steps = await installWithRequirements(catalogue, id, { root: at.root, mdeckVersion: VERSION, force, has: pack => pack !== id && Object.hasOwn(packsAt(at), pack) })
        ok(`Updated ${id} ${have.version ?? entry.bundledVersion} → ${steps.at(-1).version}`)
      }
      loadRegistry(at.deck)
      return
    }

    if (sub === 'list') {
      const [where] = rest
      const hidden = removedPacks()
      console.log(`\n  ${c.bold}Come with mdeck${c.reset}`)
      for (const id of Object.keys(bundledPacks({ all: true }))) console.log(`    ${c.cyan}${id}${c.reset}${hidden.includes(id) ? ` ${c.dim}(removed; mdeck themes install ${id} brings it back)${c.reset}` : ''}`)
      const sections = [['For every deck', userExtensionsDir()], ...(where || local ? [['Beside the deck', target(where, true).root]] : [])]
      for (const [label, root] of sections) {
        const packs = installedPacks(root)
        console.log(`\n  ${c.bold}${label}${c.reset} ${c.dim}${root}${c.reset}`)
        if (!Object.keys(packs).length) console.log(`    ${c.dim}none${c.reset}`)
        for (const [id, pack] of Object.entries(packs)) console.log(`    ${c.cyan}${id}${c.reset} ${pack.version} — ${pack.folders.join(', ')}${pack.requires.length ? ` ${c.dim}(requires ${pack.requires.join(', ')})${c.reset}` : ''}`)
      }
      console.log()
      return
    }

    if (sub === 'build') {
      const [packsDir] = rest
      const out = output()
      if (!packsDir || !out) { err('Name the packs folder and the output folder.'); return tip('Usage: mdeck themes build <packs folder> -o <output folder> [--check]') }
      const bundled = bundledPacks({ all: true })
      const index = buildRepository(resolve(packsDir), resolve(out), { bundled })
      // The repository's own themes and palettes go beside the sample deck;
      // the bundled ones are in it already.
      const extensions = Object.fromEntries(index.packs.filter(pack => !pack.bundled).flatMap(pack => [...pack.themes, ...pack.palettes].map(id => [id, resolve(packsDir, pack.id, id)])))
      const dirOf = id => extensions[id] ?? resolve(bundled[index.packs.find(pack => [...pack.themes, ...pack.palettes].includes(id)).id], id)
      const paletteTheme = id => /^theme\s*=\s*"([^"]+)"/m.exec(readFileSync(resolve(dirOf(id), 'extension.toml'), 'utf8'))?.[1] ?? 'neue'
      const { checkLooks, renderPreviews, buildSampleDeck } = await import('../build/themeCheck.js')
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
      // For the repository's theme browser: the sample deck with every theme
      // and palette, and what each theme offers.
      const registry = buildSampleDeck({ extensions, outDir: resolve(out, 'preview') })
      writeFileSync(resolve(out, 'looks.json'), JSON.stringify(looksOf(registry, index), null, 2) + '\n')
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
