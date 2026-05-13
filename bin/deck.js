#!/usr/bin/env node
import { createServer, build, preview } from 'vite'
import { existsSync, copyFileSync, mkdtempSync } from 'fs'
import { rm } from 'fs/promises'
import { resolve, dirname } from 'path'
import { tmpdir } from 'os'
import { fileURLToPath } from 'url'
import preact from '@preact/preset-vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { slidesPlugin } from '../src/slidesPlugin.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const frameworkRoot = resolve(__dirname, '..')

function baseConfig(slidesPath) {
  const abs = resolve(slidesPath)
  return {
    configFile: false,
    root: frameworkRoot,
    plugins: [preact(), slidesPlugin(abs)],
    server: {
      fs: { allow: [frameworkRoot, dirname(abs)] },
    },
  }
}

const HELP = `
  deck — markdown slide deck compiler

  Usage:
    deck dev <slides.md>                Start dev server with live reload
    deck build <slides.md>              Build → dist/index.html
    deck build <slides.md> -o out.html  Build to a specific file
    deck preview                        Preview the last build
    deck --help                         Show this message
`

const [command, ...argv] = process.argv.slice(2)

if (!command || command === '--help' || command === '-h') {
  console.log(HELP)
  process.exit(0)
}

// ── dev ──────────────────────────────────────────────────────────────────────
if (command === 'dev') {
  const input = argv[0]
  if (!input) { console.error('Error: specify a slides file\n  deck dev <slides.md>'); process.exit(1) }
  if (!existsSync(input)) { console.error(`Error: file not found: ${input}`); process.exit(1) }

  const server = await createServer({
    ...baseConfig(input),
    server: {
      open: true,
      fs: { allow: [frameworkRoot, dirname(resolve(input))] },
    },
  })
  await server.listen()
  server.printUrls()
  console.log('\n  Watching', resolve(input), '— edit and save to reload\n')

// ── build ─────────────────────────────────────────────────────────────────────
} else if (command === 'build') {
  const input = argv[0]
  if (!input) { console.error('Error: specify a slides file\n  deck build <slides.md>'); process.exit(1) }
  if (!existsSync(input)) { console.error(`Error: file not found: ${input}`); process.exit(1) }

  const outputFlagIdx = argv.findIndex(a => a === '--output' || a === '-o')
  const outputPath = outputFlagIdx !== -1 ? resolve(process.cwd(), argv[outputFlagIdx + 1]) : null
  const defaultOut = resolve(process.cwd(), 'dist/index.html')

  // When a custom output path is given, build into a temp dir then move the file
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

  if (outputPath && tempDir) {
    copyFileSync(resolve(tempDir, 'index.html'), outputPath)
    await rm(tempDir, { recursive: true })
    console.log('\n  Built:', outputPath, '\n')
  } else {
    console.log('\n  Built:', defaultOut, '\n')
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
  console.error(`Unknown command: "${command}". Run deck --help for usage.`)
  process.exit(1)
}
