// `mdeck themes` and `mdeck palettes`: install, update and remove themes and
// palettes, each on its own. Some come with mdeck, the others from the theme
// repository. A theme brings its default palette along, a palette that
// belongs to one theme brings that theme. They are installed for every deck
// (~/.mdeck/extensions) unless a deck or folder is named, or --local is
// given: then into the extensions folder beside it, so the slide folder
// carries them. A built-in one is removed by hiding it and installed again
// from mdeck's own copy, so that works offline. `mdeck themes build` is for
// the repository itself.
import { existsSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { loadRegistry, manifestsOf, removedBuiltIns, userExtensionsDir } from '../extensions/discover.js'
import { target, installHere, removeHere } from '../extensions/installed.js'
import { palettesFor } from '../extensions/tokens.js'
import { ManifestError } from '../extensions/manifest.js'
import { buildRepository, compareVersions, findEntry, installedPackages, keyOf, loadCatalogue, PackageError } from '../extensions/packages.js'

const VERSION = createRequire(import.meta.url)('../../package.json').version

const usage = kind => `search [words] | install <${kind}> | remove <${kind}> | update [${kind}] | list — for every deck, or beside a deck with [slides.md or folder] or --local${kind === 'theme' ? '; build <repository> -o <out> [--check]' : ''}`

// Every theme with the palettes it offers, and every palette's colours, each
// marked as built in or from the repository: for the theme browser.
function looksOf(registry, catalogue) {
  const builtIn = new Set([...catalogue.themes, ...catalogue.palettes].filter(entry => entry.builtIn).map(entry => entry.id + (catalogue.themes.includes(entry) ? ':t' : ':p')))
  const palettes = manifestsOf(registry, 'palette')
  // Each theme's icon for the gallery's list (see renderPreviews).
  const icons = new Map(catalogue.themes.map(entry => [entry.id, entry.icon]))
  const colours = tokens => Object.fromEntries(['--bg', '--surface', '--ink', '--accent', '--accent-2', '--accent-3'].map(key => [key, tokens?.[key] ?? null]))
  return {
    mdeck: VERSION,
    themes: Object.values(manifestsOf(registry, 'theme')).map(theme => ({ id: theme.id, title: theme.title, description: theme.description ?? '', builtIn: builtIn.has(theme.id + ':t'),
      // The oldest mdeck it works with, for the gallery's install note.
      ...(registry.themes[theme.id]?.package?.mdeck ? { mdeck: registry.themes[theme.id].package.mdeck } : {}),
      palette: theme.palette, appearance: theme.appearance ?? 'light', palettes: palettesFor(theme, palettes).map(p => p.id), ...(theme.guide ? { guide: theme.guide } : {}),
      ...(icons.get(theme.id) ? { icon: icons.get(theme.id) } : {}) })),
    palettes: Object.values(palettes).map(palette => ({ id: palette.id, title: palette.title, description: palette.description ?? '', builtIn: builtIn.has(palette.id + ':p'),
      ...(palette.theme ? { theme: palette.theme } : {}), light: colours(palette.light), dark: colours(palette.dark) })),
  }
}

export async function runPackages({ kind, positionals, flag, output, ui: { ok, err, tip, c } }) {
  const kinds = `${kind}s`
  const [sub = 'search', ...rest] = positionals
  const local = flag('--local'), force = flag('--force')
  const warnOffline = catalogue => { if (catalogue.offline) tip(`The theme repository could not be reached (${catalogue.offline}); showing the ${kinds} that come with mdeck.`) }
  const label = step => `the ${step.kind} ${step.id}`
  try {
    if (sub === 'search') {
      const catalogue = await loadCatalogue()
      warnOffline(catalogue)
      const words = rest.map(word => word.toLowerCase())
      const forEvery = installedPackages(userExtensionsDir()), here = installedPackages(resolve('extensions')), hidden = removedBuiltIns()
      const found = catalogue.entries.filter(entry => entry.kind === kind && words.every(word => [entry.id, entry.title, entry.description, entry.palette ?? '', entry.theme ?? '', ...(entry.guide?.suits ?? [])].join(' ').toLowerCase().includes(word)))
      if (!found.length) return tip(`No ${kind} matches${words.length ? ` "${words.join(' ')}"` : ''}`)
      for (const entry of found) {
        const key = keyOf(kind, entry.id)
        const have = here[key] ?? forEvery[key]
        const state = have ? (compareVersions(entry.version, have.version ?? '0.0.0') > 0 ? ` ${c.yellow}(${have.version} installed, update available)${c.reset}` : ` ${c.green}(installed)${c.reset}`)
          : entry.builtIn ? (hidden.includes(key) ? ` ${c.dim}(comes with mdeck, removed)${c.reset}` : ` ${c.green}(comes with mdeck)${c.reset}`)
          : entry.builtInVersion ? ` ${c.yellow}(comes with mdeck as ${entry.builtInVersion}, update available)${c.reset}` : ''
        console.log(`\n  ${c.cyan}${entry.id}${c.reset} ${entry.version} — ${entry.title}${state}`)
        if (entry.description) console.log(`    ${entry.description}`)
        if (entry.guide?.suits) console.log(`    Suits: ${entry.guide.suits.join(' · ')}`)
        const facts = [kind === 'theme' ? `palette: ${entry.palette}` : entry.theme ? `only for the theme ${entry.theme}` : '', entry.author ? `by ${entry.author}` : '', entry.license].filter(Boolean)
        if (facts.length) console.log(`    ${c.dim}${facts.join(' · ')}${c.reset}`)
      }
      console.log()
      return tip(`Install one for every deck with: mdeck ${kinds} install <${kind}>   (beside a deck: add slides.md or --local)`)
    }

    if (sub === 'install') {
      const [id, where] = rest
      if (!id) { err(`Name a ${kind}.`); return tip(`Usage: mdeck ${kinds} install <${kind}> [slides.md or folder] [--local]; mdeck ${kinds} search lists them.`) }
      const at = target(where, local)
      const catalogue = await loadCatalogue()
      warnOffline(catalogue)
      findEntry(catalogue, kind, id)
      for (const step of await installHere(catalogue, kind, id, at, { mdeckVersion: VERSION, force })) {
        const what = step.requested ? label(step) : `${label(step)}, which it needs,`
        if (step.kept) tip(`${what[0].toUpperCase() + what.slice(1)} is there already`)
        else if (step.builtIn) step.wasRemoved || step.requested ? ok(`${label(step)[0].toUpperCase() + label(step).slice(1)} comes with mdeck${step.wasRemoved ? ' and is offered again' : ''}`) : null
        else ok(`${step.replaced ? `Updated ${label(step)} from ${step.replaced} to ${step.version}` : `Installed ${label(step)} ${step.version}`} ${at.label}`)
      }
      tip(`Use it with "${kind}: ${id}" at the top of a slide file. Look at it on a sample deck: mdeck design`)
      return
    }

    if (sub === 'remove') {
      const [id, where] = rest
      if (!id) { err(`Name a ${kind}.`); return tip(`Usage: mdeck ${kinds} remove <${kind}> [slides.md or folder] [--local]`) }
      const at = target(where, local)
      for (const step of removeHere(kind, id, at, { force })) {
        ok(step.hidden ? `${label(step)[0].toUpperCase() + label(step).slice(1)} comes with mdeck and is no longer offered; mdeck ${step.kind}s install ${step.id} brings it back` : `Removed ${label(step)} ${at.label}`)
      }
      return
    }

    if (sub === 'update') {
      const [first, second] = rest
      const named = first && !/\.md$/i.test(first) && !(existsSync(first) && statSync(first).isDirectory()) ? first : null
      const at = target(named ? second : first, local)
      const catalogue = await loadCatalogue()
      warnOffline(catalogue)
      const installed = Object.values(installedPackages(at.root)).filter(item => item.kind === kind)
      const ids = named ? [named] : installed.map(item => item.id)
      if (!ids.length) return tip(`No ${kinds} installed ${at.label}`)
      for (const id of ids) {
        const have = installed.find(item => item.id === id)
        if (!have) throw new PackageError(`The ${kind} ${id} is not installed ${at.label}`)
        const entry = findEntry(catalogue, kind, id)
        if (entry.builtIn || compareVersions(entry.version, have.version ?? '0.0.0') <= 0) { tip(`The ${kind} ${id} ${have.version} is up to date`); continue }
        await installHere(catalogue, kind, id, at, { mdeckVersion: VERSION, force })
        ok(`Updated the ${kind} ${id} ${have.version} → ${entry.version}`)
      }
      loadRegistry(at.deck)
      return
    }

    if (sub === 'list') {
      const [where] = rest
      const hidden = removedBuiltIns()
      const catalogue = await loadCatalogue({ online: false })
      console.log(`\n  ${c.bold}Come with mdeck${c.reset}`)
      for (const entry of catalogue.entries.filter(entry => entry.kind === kind)) console.log(`    ${c.cyan}${entry.id}${c.reset}${hidden.includes(keyOf(kind, entry.id)) ? ` ${c.dim}(removed; mdeck ${kinds} install ${entry.id} brings it back)${c.reset}` : ''}`)
      const sections = [['For every deck', userExtensionsDir()], ...(where || local ? [['Beside the deck', target(where, true).root]] : [])]
      for (const [title, root] of sections) {
        const items = Object.values(installedPackages(root)).filter(item => item.kind === kind)
        console.log(`\n  ${c.bold}${title}${c.reset} ${c.dim}${root}${c.reset}`)
        if (!items.length) console.log(`    ${c.dim}none${c.reset}`)
        for (const item of items) console.log(`    ${c.cyan}${item.id}${c.reset} ${item.version}`)
      }
      console.log()
      return
    }

    if (sub === 'build' && kind === 'theme') {
      const [repoDir] = rest
      const out = output()
      if (!repoDir || !out) { err('Name the repository folder and the output folder.'); return tip('Usage: mdeck themes build <repository folder> -o <output folder> [--check]') }
      const { catalogue, dirs } = buildRepository(resolve(repoDir), resolve(out))
      // The repository's own themes and palettes go beside the sample deck;
      // the built-in ones are in it already.
      const repo = [...catalogue.themes.map(e => ({ ...e, kind: 'theme' })), ...catalogue.palettes.map(e => ({ ...e, kind: 'palette' }))].filter(entry => !entry.builtIn)
      const extensions = Object.fromEntries(repo.map(entry => [keyOf(entry.kind, entry.id), dirs[keyOf(entry.kind, entry.id)]]))
      const { checkLooks, renderPreviews, buildSampleDeck } = await import('../build/themeCheck.js')
      const looks = [...catalogue.themes, ...catalogue.palettes.map(p => ({ ...p, isPalette: true }))].map(entry => entry.isPalette
        ? { key: `palettes/${entry.id}`, theme: entry.theme ?? 'neue', palette: entry.id }
        : { key: `themes/${entry.id}`, theme: entry.id })
      if (flag('--check')) {
        const failures = await checkLooks(looks, { extensions })
        if (failures.length) { err(`The theme check found ${failures.length} problem(s):`); for (const line of failures) console.error(`    ${line}`); process.exitCode = 1; return }
        ok(`Checked ${catalogue.themes.length} themes and ${catalogue.palettes.length} palettes, light and dark, on every kind of slide`)
      }
      // Themes on the title slide, palettes on the chapter slide (the third).
      // Themes also get an icon of their title slide for lists; a palette's
      // colours are its icon.
      await renderPreviews(looks.map(look => ({ file: resolve(out, 'previews', `${look.key}.webp`), theme: look.theme, palette: look.palette ?? '', slide: look.palette ? 3 : 1,
        ...(look.palette ? {} : { icon: resolve(out, 'previews', `${look.key}-icon.webp`) }) })), { extensions })
      for (const entry of catalogue.themes) Object.assign(entry, { preview: `previews/themes/${entry.id}.webp`, icon: `previews/themes/${entry.id}-icon.webp` })
      for (const entry of catalogue.palettes) entry.preview = `previews/palettes/${entry.id}.webp`
      writeFileSync(resolve(out, 'catalogue.json'), JSON.stringify(catalogue, null, 2) + '\n')
      // For the repository's theme browser: the sample deck with every theme
      // and palette, and what each theme offers.
      const registry = buildSampleDeck({ extensions, outDir: resolve(out, 'preview') })
      writeFileSync(resolve(out, 'looks.json'), JSON.stringify(looksOf(registry, catalogue), null, 2) + '\n')
      return ok(`Built ${catalogue.themes.length} themes and ${catalogue.palettes.length} palettes into ${resolve(out)}`)
    }

    err(`Unknown: mdeck ${kinds} ${sub}`)
    tip(`Use: mdeck ${kinds} ${usage(kind)}`)
    process.exitCode = 1
  } catch (error) {
    if (!(error instanceof PackageError || error instanceof ManifestError)) throw error
    err(error.message)
    process.exitCode = 1
  }
}
