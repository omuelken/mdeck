import { createServer, build, preview } from 'vite'
import { existsSync, copyFileSync, mkdtempSync, readdirSync, readFileSync } from 'fs'
import { chmod, rm, mkdir, writeFile } from 'fs/promises'
import { resolve, dirname, basename, relative, isAbsolute } from 'path'
import { tmpdir } from 'os'
import readline from 'readline/promises'
import preact from '@preact/preset-vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { collectLocalAssetRefs, slidesPlugin } from '../build/slidesPlugin.js'
import { parseSlides } from '../core/parseSlides.js'
import { validateDeck, formatDiagnostics } from '../core/validateDeck.js'
import { templateManifests } from '../build/discoverTemplates.js'
import { builtinManifests } from '../templates/templateManifests.js'

import { frameworkRoot, assetsRoot } from '../paths.js'
import { baseConfig } from '../build/config.js'

// ── ANSI helpers ──────────────────────────────────────────────────────────────
const tty = process.stdout.isTTY
const c = tty
  ? { reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', green: '\x1b[32m', cyan: '\x1b[36m', yellow: '\x1b[33m', red: '\x1b[31m' }
  : Object.fromEntries(['reset','bold','dim','green','cyan','yellow','red'].map(k => [k, '']))

const ok  = msg => console.log(`  ${c.green}✓${c.reset}  ${msg}`)
const err = msg => console.error(`  ${c.red}✗${c.reset}  ${msg}`)
const tip = msg => console.log(`  ${c.dim}${msg}${c.reset}`)

const THEMES = ['neue', 'aurora', 'duet', 'fhnw', 'editorial', 'terminal']
const ASPECT_RATIOS = [
  { label: '16:9 (widescreen)', w: 16, h: 9 },
  { label: '16:10 (widescreen)', w: 16, h: 10 },
  { label: '4:3 (classic)', w: 4, h: 3 },
]



function hasFlag(name, short = null) {
  return argv.includes(name) || (short ? argv.includes(short) : false)
}

function availablePalettes() {
  const dir = resolve(assetsRoot, 'palettes')
  return readdirSync(dir)
    .filter(name => name.endsWith('.json'))
    .map(name => name.replace(/\.json$/, ''))
    .sort()
}

function parseSelection(input, max) {
  const picks = [...new Set(
    String(input || '')
      .split(',')
      .map(v => parseInt(v.trim(), 10))
      .filter(n => Number.isInteger(n) && n >= 1 && n <= max)
  )]
  return picks
}


async function runNewWizard() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const palettes = availablePalettes()
  try {
    console.log()
    console.log(`  ${c.bold}Create a new deck${c.reset}`)
    const rawPath = (await rl.question('  Deck file path (default: slides.md): ')).trim() || 'slides.md'
    const outPath = resolve(process.cwd(), rawPath)
    if (existsSync(outPath)) {
      err(`File already exists: ${outPath}`)
      process.exit(1)
    }

    console.log('\n  Theme:')
    THEMES.forEach((name, i) => console.log(`    ${i + 1}) ${name}`))
    const tIdx = parseInt((await rl.question('  Pick a theme [1]: ')).trim() || '1', 10)
    const theme = THEMES[tIdx - 1] || THEMES[0]

    console.log('\n  Palette:')
    console.log('    0) none')
    palettes.forEach((name, i) => console.log(`    ${i + 1}) ${name}`))
    const pRaw = (await rl.question('  Pick a palette [0]: ')).trim() || '0'
    const pIdx = parseInt(pRaw, 10)
    const palette = pIdx > 0 ? (palettes[pIdx - 1] || '') : ''

    const LAYOUT_LIBRARY = Object.values(templateManifests(outPath)).map(manifest => ({ key: manifest.name, label: manifest.title, starter: manifest.starter }))
    console.log('\n  Slide templates (comma-separated numbers):')
    LAYOUT_LIBRARY.forEach((opt, i) => console.log(`    ${i + 1}) ${opt.label}`))
    const defaultLayouts = '1,2,3,4'
    const picks = parseSelection((await rl.question(`  Pick templates [${defaultLayouts}]: `)).trim() || defaultLayouts, LAYOUT_LIBRARY.length)
    const chosen = (picks.length ? picks : parseSelection(defaultLayouts, LAYOUT_LIBRARY.length))
      .map(i => LAYOUT_LIBRARY[i - 1])

    const title = (await rl.question('  Presentation title [My Talk]: ')).trim() || 'My Talk'
    const author = (await rl.question('  Author [Your Name]: ')).trim() || 'Your Name'
    const org = (await rl.question('  Organization [FHNW]: ')).trim() || 'FHNW'

    console.log('\n  Aspect ratio (uses 1920px width baseline):')
    ASPECT_RATIOS.forEach((opt, i) => console.log(`    ${i + 1}) ${opt.label}`))
    console.log(`    ${ASPECT_RATIOS.length + 1}) Custom`)
    const rIdx = parseInt((await rl.question('  Pick an aspect ratio [1]: ')).trim() || '1', 10)
    let width = 1920
    let ratioW = ASPECT_RATIOS[0].w
    let ratioH = ASPECT_RATIOS[0].h
    if (rIdx >= 1 && rIdx <= ASPECT_RATIOS.length) {
      ratioW = ASPECT_RATIOS[rIdx - 1].w
      ratioH = ASPECT_RATIOS[rIdx - 1].h
    } else if (rIdx === ASPECT_RATIOS.length + 1) {
      const rawW = parseInt((await rl.question('  Ratio width [16]: ')).trim() || '16', 10)
      const rawH = parseInt((await rl.question('  Ratio height [9]: ')).trim() || '9', 10)
      ratioW = Number.isInteger(rawW) && rawW > 0 ? rawW : ratioW
      ratioH = Number.isInteger(rawH) && rawH > 0 ? rawH : ratioH
    }
    const height = Math.round((width * ratioH) / ratioW)

    const lines = [
      '---',
      `design: ${theme}`,
      ...(palette ? [`palette: ${palette}`] : []),
      'meta:',
      `  title: "${title.replace(/"/g, '\\"')}"`,
      `  author: "${author.replace(/"/g, '\\"')}"`,
      `  organization: "${org.replace(/"/g, '\\"')}"`,
      `  date: "${new Date().toISOString().slice(0, 10)}"`,
      '  logo: ./img/logo.png',
      `width: ${width}`,
      `height: ${height}`,
      '---',
      '',
    ]

    chosen.forEach((opt, i) => {
      lines.push('---\n' + opt.starter)
      lines.push('')
    })

    await mkdir(dirname(outPath), { recursive: true })
    await writeFile(outPath, lines.join('\n'), 'utf-8')

    const assetDir = resolve(dirname(outPath), 'img')
    await mkdir(assetDir, { recursive: true })
    await writeFile(resolve(assetDir, '.gitkeep'), '', 'utf-8')

    console.log()
    ok(`Created ${c.cyan}${outPath}${c.reset}`)
    tip(`Added assets folder: ${assetDir}`)
    tip(`Next: mdeck dev ${basename(outPath)}\n`)
  } finally {
    rl.close()
  }
}

async function copyLocalAssets(slidesPath, outDir) {
  const absSlides = resolve(slidesPath)
  const deckDir = dirname(absSlides)
  const absOutDir = resolve(outDir)
  const markdown = readFileSync(absSlides, 'utf-8')

  for (const ref of collectLocalAssetRefs(markdown)) {
    const source = resolve(deckDir, ref)
    const destination = resolve(absOutDir, ref)
    const outputRelativePath = relative(absOutDir, destination)

    // Preserve deck-relative paths, but never let a reference write outside
    // the selected build directory.
    if (outputRelativePath.startsWith('..') || isAbsolute(outputRelativePath)) continue
    if (!existsSync(source)) continue

    await mkdir(dirname(destination), { recursive: true })
    copyFileSync(source, destination)
  }
}

function posixPresenterLauncher(htmlFilename) {
  const page = encodeURIComponent(htmlFilename)
  return [
    '#!/usr/bin/env sh',
    'set -eu',
    '',
    'SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)',
    'cd "$SCRIPT_DIR"',
    '',
    'PORT=${1:-8765}',
    'if command -v python3 >/dev/null 2>&1; then',
    '  PYTHON=python3',
    'elif command -v python >/dev/null 2>&1; then',
    '  PYTHON=python',
    'else',
    '  echo "Python 3 is required to start the presenter view." >&2',
    '  exit 1',
    'fi',
    '',
    `URL="http://127.0.0.1:$PORT/${page}?presenter=1"`,
    '"$PYTHON" -m http.server "$PORT" --bind 127.0.0.1 &',
    'SERVER_PID=$!',
    'cleanup() {',
    '  kill "$SERVER_PID" 2>/dev/null || true',
    '}',
    'trap cleanup EXIT INT TERM',
    '',
    'sleep 1',
    'case "$(uname -s)" in',
    '  Darwin) open "$URL" ;;',
    '  Linux)',
    '    if command -v xdg-open >/dev/null 2>&1; then',
    '      xdg-open "$URL"',
    '    else',
    '      echo "Open $URL in a browser."',
    '    fi',
    '    ;;',
    '  *) echo "Open $URL in a browser." ;;',
    'esac',
    '',
    'echo "Presenter server running at $URL"',
    'echo "Press Ctrl+C to stop."',
    'wait "$SERVER_PID"',
    '',
  ].join('\n')
}

function windowsPresenterLauncher(htmlFilename) {
  return [
    '@echo off',
    'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0present.ps1" %*',
    '',
  ].join('\r\n')
}

function powershellPresenterLauncher(htmlFilename) {
  const page = encodeURIComponent(htmlFilename)
  return [
    'param([int]$Port = 8765)',
    '$ErrorActionPreference = "Stop"',
    'Set-Location $PSScriptRoot',
    '',
    '$Py = Get-Command py -ErrorAction SilentlyContinue',
    'if ($Py) {',
    '  $Python = $Py.Source',
    '  $Prefix = @("-3")',
    '} else {',
    '  $Py = Get-Command python -ErrorAction SilentlyContinue',
    '  if (-not $Py) { throw "Python 3 is required to start the presenter view." }',
    '  $Python = $Py.Source',
    '  $Prefix = @()',
    '}',
    '',
    `$Url = "http://127.0.0.1:$Port/${page}?presenter=1"`,
    '$Arguments = $Prefix + @("-m", "http.server", "$Port", "--bind", "127.0.0.1")',
    '$Server = Start-Process -FilePath $Python -ArgumentList $Arguments -PassThru -NoNewWindow',
    'try {',
    '  Start-Sleep -Milliseconds 750',
    '  Start-Process $Url',
    '  Write-Host "Presenter server running at $Url"',
    '  Write-Host "Press Ctrl+C to stop."',
    '  Wait-Process -Id $Server.Id',
    '} finally {',
    '  $Server.Refresh()',
    '  if (-not $Server.HasExited) { Stop-Process -Id $Server.Id -Force }',
    '}',
    '',
  ].join('\n')
}

async function writePresenterLaunchers(outDir, htmlFilename) {
  const shellPath = resolve(outDir, 'present.sh')
  await writeFile(shellPath, posixPresenterLauncher(htmlFilename), 'utf-8')
  await chmod(shellPath, 0o755)
  await writeFile(resolve(outDir, 'present.bat'), windowsPresenterLauncher(htmlFilename), 'utf-8')
  await writeFile(resolve(outDir, 'present.ps1'), powershellPresenterLauncher(htmlFilename), 'utf-8')
}

// ── Help ──────────────────────────────────────────────────────────────────────
const HELP = `
  ${c.bold}mdeck${c.reset} — markdown slide deck

  ${c.dim}Usage:${c.reset}
    ${c.green}mdeck dev${c.reset} <slides.md>                  Start dev server with live reload
    ${c.green}mdeck present${c.reset} <slides.md>              Open speaker/presenter view
    ${c.green}mdeck new${c.reset}                              Interactive deck scaffolding wizard
    ${c.green}mdeck build${c.reset} <slides.md> [-o out.html]
                                              Build HTML + copied local assets
    ${c.green}mdeck build${c.reset} <slides.md> [-o out.html] [--self-contained]
                                              Inline local images/media into one HTML file
    ${c.green}mdeck build${c.reset} <slides.md> [--presenter-launchers]
                                              Add macOS/Linux and Windows launchers
    ${c.green}mdeck preview${c.reset}                          Preview the last build
    ${c.green}mdeck docs${c.reset} [guide]                      Open the local documentation
      --no-open   --port <number>   --build    Serve without opening, choose port, or build site
    ${c.green}mdeck check${c.reset} <slides.md> [--strict]       Validate source and local assets
    ${c.green}mdeck templates${c.reset} <slides.md> [--json]      List built-in and deck-local templates
    ${c.green}mdeck templates${c.reset} <slides.md> --starter <name>
                                              Print starter Markdown for a template

  ${c.dim}Install the${c.reset} ${c.bold}mdeck${c.reset} ${c.dim}command globally:${c.reset}
    npm link

  ${c.dim}Or run without installing:${c.reset}
    npm run dev -- slides.md
    npm run build -- slides.md
`

// ── Argument parsing ──────────────────────────────────────────────────────────
const [command, ...argv] = process.argv.slice(2)

if (!command || command === '--help' || command === '-h') {
  console.log(HELP)
  process.exit(0)
}

function requireInput(cmd) {
  const input = argv[0]
  if (!input) {
    err(`No slides file specified.`)
    tip(`Usage: mdeck ${cmd} <slides.md>`)
    tip(`       npm run ${cmd} -- slides.md`)
    process.exit(1)
  }
  if (!existsSync(input)) {
    err(`File not found: ${input}`)
    process.exit(1)
  }
  return input
}

// ── dev ───────────────────────────────────────────────────────────────────────
if (command === 'new') {
  await runNewWizard()

} else if (command === 'docs') {
  try {
    const options = { page: 'index', open: true, port: 4174 }
    let buildOnly = false
    for (let i = 0; i < argv.length; i++) {
      const arg = argv[i]
      if (arg === '--no-open') options.open = false
      else if (arg === '--build') buildOnly = true
      else if (arg === '--port') {
        options.port = Number(argv[++i])
        if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) throw new Error('Choose a port number between 1 and 65535.')
      } else if (arg.startsWith('-')) throw new Error(`Unknown documentation option: ${arg}`)
      else if (options.page !== 'index') throw new Error('Choose one guide to open.')
      else options.page = arg.replace(/\.html$/, '')
    }
    const { pageFor } = await import('../../docs/site/pages.js')
    if (!pageFor(options.page)) throw new Error(`No guide named "${options.page}". Try mdeck docs getting-started.`)
    if (buildOnly) {
      const { buildDocs } = await import('../../docs/site/build.js')
      ok(`Documentation built: ${await buildDocs()}`)
    } else {
      tip('Preparing the guides and slide examples…')
      const { startDocs } = await import('../../docs/site/server.js')
      const docs = await startDocs(options)
      ok(`Documentation: ${docs.url}`)
      tip('Press Ctrl+C to close the documentation server.')
      const stop = async () => { await docs.close(); process.exit(0) }
      process.once('SIGINT', stop)
      process.once('SIGTERM', stop)
    }
  } catch (error) { err(error.message); process.exitCode = 1 }

} else if (command === 'check') {
  const input = requireInput('check')
  const source = readFileSync(input, 'utf8')
  const diagnostics = validateDeck(parseSlides(source), { templates: templateManifests(input) })
  for (const ref of collectLocalAssetRefs(source)) {
    if (!existsSync(resolve(dirname(resolve(input)), ref))) diagnostics.push({ severity: 'error', code: 'missing-asset', message: `Missing local asset: ${ref}`, line: 1, column: 1 })
  }
  if (diagnostics.length) console.log(formatDiagnostics(diagnostics, input))
  if (diagnostics.some(d => d.severity === 'error' || hasFlag('--strict'))) process.exitCode = 1
  else ok(`Checked ${input}${diagnostics.length ? ' (with warnings)' : ''}`)

} else if (command === 'templates') {
  const input = requireInput('templates')
  const templates = templateManifests(input)
  const starterIndex = argv.indexOf('--starter')
  if (starterIndex >= 0) {
    const name = argv[starterIndex + 1]
    if (!Object.hasOwn(templates, name)) { err(`Unknown template: ${name}`); process.exitCode = 1 }
    else process.stdout.write(templates[name].starter)
  } else if (hasFlag('--json')) console.log(JSON.stringify(templates, null, 2))
  else for (const manifest of Object.values(templates)) console.log(`  ${manifest.name} — ${manifest.title} (${Object.hasOwn(builtinManifests, manifest.name) ? 'built-in' : 'local'})`)

// ── dev ───────────────────────────────────────────────────────────────────────
} else if (command === 'dev') {
  const input = requireInput('dev')
  const base = baseConfig(input)

  const server = await createServer({
    ...base,
    publicDir: dirname(resolve(input)),
    server: {
      ...base.server,
      open: true,
    },
  })
  await server.listen()
  server.printUrls()
  console.log()
  ok(`Watching ${c.cyan}${resolve(input)}${c.reset}`)
  tip('Edit and save to reload.\n')

// ── present ───────────────────────────────────────────────────────────────────
} else if (command === 'present') {
  const input = requireInput('present')
  const base = baseConfig(input)

  const server = await createServer({
    ...base,
    publicDir: dirname(resolve(input)),
    server: {
      ...base.server,
      open: '/?presenter=1',
    },
  })
  await server.listen()
  server.printUrls()
  console.log()
  ok(`Speaker view opened`)
  tip('Audience view: /')
  tip('Presenter view: /?presenter=1\n')

// ── build ─────────────────────────────────────────────────────────────────────
} else if (command === 'build') {
  const input = requireInput('build')
  const selfContained = hasFlag('--self-contained', '-S')
  const inlineImages = selfContained || hasFlag('--inline-images', '-I')
  const presenterLaunchers = hasFlag('--presenter-launchers')

  if (selfContained && presenterLaunchers) {
    err('--presenter-launchers is only available for directory bundles.')
    process.exit(1)
  }

  const outputFlagIdx = argv.findIndex(a => a === '--output' || a === '-o')
  const outputPath = outputFlagIdx !== -1 ? resolve(process.cwd(), argv[outputFlagIdx + 1]) : null

  const tempDir = outputPath ? mkdtempSync(resolve(tmpdir(), 'mdeck-')) : null
  const outDir = tempDir ?? resolve(process.cwd(), 'dist')
  const finalOutDir = outputPath ? dirname(outputPath) : outDir
  const htmlFilename = outputPath ? basename(outputPath) : 'index.html'

  await build({
    ...baseConfig(input, { selfContained }),
    plugins: [preact(), slidesPlugin(resolve(input), { inlineImages, inlineMedia: selfContained }), viteSingleFile()],
    build: {
      outDir,
      emptyOutDir: !tempDir,
      target: 'esnext',
      assetsInlineLimit: 100 * 1024 * 1024,
    },
  })

  await mkdir(finalOutDir, { recursive: true })

  if (!selfContained) {
    await copyLocalAssets(input, finalOutDir)
    if (presenterLaunchers) await writePresenterLaunchers(finalOutDir, htmlFilename)
  }

  if (outputPath && tempDir) {
    copyFileSync(resolve(tempDir, 'index.html'), outputPath)
    await rm(tempDir, { recursive: true })
    ok(`Built: ${c.cyan}${outputPath}${c.reset}${selfContained ? ' (self-contained)' : inlineImages ? ' (images inlined)' : ' + local assets'}\n`)
  } else {
    ok(`Built: ${c.cyan}${resolve(outDir, 'index.html')}${c.reset}${selfContained ? ' (self-contained)' : inlineImages ? ' (images inlined + local assets)' : ' + local assets'}\n`)
  }

// ── preview ───────────────────────────────────────────────────────────────────
} else if (command === 'preview') {
  const server = await preview({
    configFile: false,
    root: frameworkRoot,
    build: { outDir: resolve(process.cwd(), 'dist') },
    preview: { open: true },
  })
  server.printUrls()

} else {
  err(`Unknown command: "${command}"`)
  tip('Run mdeck --help for usage.\n')
  process.exit(1)
}
