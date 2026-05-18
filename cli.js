#!/usr/bin/env node
import { createServer, build, preview } from 'vite'
import { existsSync, copyFileSync, mkdtempSync } from 'fs'
import { cp, rm } from 'fs/promises'
import { resolve, dirname } from 'path'
import { tmpdir } from 'os'
import { fileURLToPath } from 'url'
import preact from '@preact/preset-vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { slidesPlugin } from './src/slidesPlugin.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const frameworkRoot = __dirname

// ── ANSI helpers ──────────────────────────────────────────────────────────────
const tty = process.stdout.isTTY
const c = tty
  ? { reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', green: '\x1b[32m', cyan: '\x1b[36m', yellow: '\x1b[33m', red: '\x1b[31m' }
  : Object.fromEntries(['reset','bold','dim','green','cyan','yellow','red'].map(k => [k, '']))

const ok  = msg => console.log(`  ${c.green}✓${c.reset}  ${msg}`)
const err = msg => console.error(`  ${c.red}✗${c.reset}  ${msg}`)
const tip = msg => console.log(`  ${c.dim}${msg}${c.reset}`)

// ── Vite config ───────────────────────────────────────────────────────────────
function baseConfig(slidesPath) {
  const abs = resolve(slidesPath)
  return {
    configFile: false,
    root: frameworkRoot,
    plugins: [preact(), slidesPlugin(abs)],
    server: {
      hmr: { host: 'localhost', clientPort: 5173 },
      port: 5173,
      strictPort: false,
      fs: { allow: [frameworkRoot, dirname(abs)] },
    },
  }
}

async function copyImages(slidesPath, outDir) {
  const imgSrc = resolve(dirname(resolve(slidesPath)), 'img')
  if (existsSync(imgSrc)) {
    await cp(imgSrc, resolve(outDir, 'img'), { recursive: true })
  }
}

// ── Help ──────────────────────────────────────────────────────────────────────
const HELP = `
  ${c.bold}deck${c.reset} — markdown slide deck

  ${c.dim}Usage:${c.reset}
    ${c.green}deck dev${c.reset} <slides.md>                  Start dev server with live reload
    ${c.green}deck present${c.reset} <slides.md>              Open speaker/presenter view
    ${c.green}deck build${c.reset} <slides.md> [-o out.html]  Build self-contained HTML
    ${c.green}deck preview${c.reset}                          Preview the last build

  ${c.dim}Install the${c.reset} ${c.bold}deck${c.reset} ${c.dim}command globally:${c.reset}
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
    tip(`Usage: deck ${cmd} <slides.md>`)
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
if (command === 'dev') {
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

  const outputFlagIdx = argv.findIndex(a => a === '--output' || a === '-o')
  const outputPath = outputFlagIdx !== -1 ? resolve(process.cwd(), argv[outputFlagIdx + 1]) : null

  const tempDir = outputPath ? mkdtempSync(resolve(tmpdir(), 'deck-')) : null
  const outDir = tempDir ?? resolve(process.cwd(), 'dist')

  await build({
    ...baseConfig(input),
    plugins: [preact(), slidesPlugin(resolve(input)), viteSingleFile()],
    build: {
      outDir,
      emptyOutDir: !tempDir,
      target: 'esnext',
      assetsInlineLimit: 100 * 1024 * 1024,
    },
  })

  await copyImages(input, outputPath ? dirname(outputPath) : outDir)

  if (outputPath && tempDir) {
    copyFileSync(resolve(tempDir, 'index.html'), outputPath)
    await rm(tempDir, { recursive: true })
    ok(`Built: ${c.cyan}${outputPath}${c.reset}\n`)
  } else {
    ok(`Built: ${c.cyan}${resolve(outDir, 'index.html')}${c.reset}\n`)
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
  tip('Run deck --help for usage.\n')
  process.exit(1)
}
