// What every command gets from its command line (args.js parsed it): the
// options, and helpers that find the deck and stop with a message when
// something is missing.
import { existsSync, readFileSync, statSync } from 'fs'
import { resolve } from 'path'
import { loadRegistry } from '../extensions/discover.js'
import { ManifestError } from '../extensions/manifest.js'
import { shareSlides } from '../core/editDeck.js'
import { parseSlideNumbers } from './args.js'
import { c, err, tip } from './ui.js'

export function commandContext(command, parsed) {
  const { options } = parsed
  const hasFlag = (name, short = null) => !!(options[name] ?? options[short])
  const positionals = () => parsed.positionals

  // --slide 3,5-7 for build, send and pdf: only these slides, numbered as written.
  function slideOption(input) {
    const given = options['--slide']
    if (given == null) return null
    try {
      const slides = parseSlideNumbers(given)
      shareSlides(readFileSync(resolve(input), 'utf-8'), { slides })
      return slides
    } catch (error) { err(error.message); process.exit(1) }
  }

  // The slides file: the first argument that is not an option, or slides.md in
  // the current folder.
  function requireInput(cmd) {
    const input = positionals()[0] ?? (existsSync('slides.md') ? 'slides.md' : null)
    if (!input) {
      err('No slides file specified.')
      tip(`Usage: mdeck ${cmd} <slides.md>   (or run it in a folder that has a slides.md)`)
      process.exit(1)
    }
    if (!existsSync(input)) {
      err(`File not found: ${input}`)
      process.exit(1)
    }
    if (statSync(input).isDirectory()) {
      err(`${input} is a folder, not a slides file.`)
      tip(existsSync(resolve(input, 'slides.md')) ? `Usage: mdeck ${cmd} ${resolve(input, 'slides.md')}` : `Usage: mdeck ${cmd} <slides.md>`)
      process.exit(1)
    }
    return input
  }

  return {
    command, options, positionals, hasFlag, slideOption, requireInput, registryFor, onPort,
    outputOption: () => options['--output'] ?? null,
    serverOption: () => options['--server'],
    portOption: () => options['--port'] ?? null,
  }
}

// Runs `start`, which opens a server on `port` (--port): when something else
// has the port, says so instead of showing a stack trace.
async function onPort(port, start) {
  try { return await start() } catch (error) {
    if (error.code !== 'EADDRINUSE' && !/EADDRINUSE|already in use/.test(error.message)) throw error
    err(`Port ${port} is in use. Choose another with --port, or stop what listens there.`)
    process.exit(1)
  }
}

// Layouts, themes and palettes all come from one registry: built-ins plus the
// extensions/ folder beside the deck. Manifest problems are reported and stop
// the command instead of being skipped silently.
function registryFor(slidesPath) {
  try {
    const registry = loadRegistry(slidesPath)
    for (const warning of registry.warnings) console.warn(`  ${c.yellow}!${c.reset}  ${warning}`)
    return registry
  } catch (error) {
    if (!(error instanceof ManifestError)) throw error
    err(error.message)
    process.exit(1)
  }
}
