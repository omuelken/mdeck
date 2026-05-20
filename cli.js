#!/usr/bin/env node
import { createServer, build, preview } from 'vite'
import { existsSync, copyFileSync, mkdtempSync, readdirSync } from 'fs'
import { cp, rm, mkdir, writeFile } from 'fs/promises'
import { resolve, dirname, basename } from 'path'
import { tmpdir } from 'os'
import { fileURLToPath } from 'url'
import readline from 'readline/promises'
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

const THEMES = ['neue', 'aurora', 'duet', 'fhnw', 'editorial', 'terminal']
const LAYOUT_LIBRARY = [
  { key: 'title', label: 'Title slide' },
  { key: 'chapter', label: 'Chapter divider' },
  { key: 'focus', label: 'Big statement' },
  { key: 'image-text', label: 'Image + text' },
  { key: 'split', label: 'Split content' },
  { key: 'full-bleed-image', label: 'Full-bleed image' },
]
const ASPECT_RATIOS = [
  { label: '16:9 (widescreen)', w: 16, h: 9 },
  { label: '16:10 (widescreen)', w: 16, h: 10 },
  { label: '4:3 (classic)', w: 4, h: 3 },
]

// ── Vite config ───────────────────────────────────────────────────────────────
function baseConfig(slidesPath) {
  const abs = resolve(slidesPath)
  return {
    configFile: false,
    root: frameworkRoot,
    plugins: [preact(), slidesPlugin(abs)],
    server: {
      port: 5173,
      strictPort: false,
      fs: { allow: [frameworkRoot, dirname(abs)] },
    },
  }
}

function hasFlag(name, short = null) {
  return argv.includes(name) || (short ? argv.includes(short) : false)
}

function availablePalettes() {
  const dir = resolve(frameworkRoot, 'palettes')
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

function createSlideTemplate(layout, section, n) {
  const idx = String(n + 1).padStart(2, '0')
  if (layout === 'title') {
    return `---\nlayout: title\n---\n# ${section}\n## A clear subtitle for your audience\n`
  }
  if (layout === 'chapter') {
    return `---\nlayout: chapter\nnumber: ${n + 1}\npart: Part ${n + 1}\ndescription: What this chapter covers\n---\n# ${section}\n`
  }
  if (layout === 'focus') {
    return `---\nlayout: focus\neyebrow: Key message\nattribution: Your Name\n---\n# One strong idea for this section.\n`
  }
  if (layout === 'image-text') {
    return `---\nlayout: image-text\nsection: ${section}\nimage: ./img/image-${idx}.jpg\n---\n## Visual context\n\nExplain the visual and connect it to your story.\n`
  }
  if (layout === 'split') {
    return `---\nlayout: split\nsection: ${section}\n---\n\n\`\`\`python\na = [1, 2, 3]\nprint(sum(a))\n\`\`\`\n\n- Explain the snippet\n- Add key takeaways\n`
  }
  return `---\nlayout: full-bleed-image\nsection: ${section}\nimage: ./img/hero-${idx}.jpg\noverlay: true\n---\n# Section highlight\n`
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
      lines.push(createSlideTemplate(opt.key, opt.label, i))
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

async function copyImages(slidesPath, outDir) {
  const imgSrc = resolve(dirname(resolve(slidesPath)), 'img')
  if (existsSync(imgSrc)) {
    await cp(imgSrc, resolve(outDir, 'img'), { recursive: true })
  }
}

// ── Help ──────────────────────────────────────────────────────────────────────
const HELP = `
  ${c.bold}mdeck${c.reset} — markdown slide deck

  ${c.dim}Usage:${c.reset}
    ${c.green}mdeck dev${c.reset} <slides.md>                  Start dev server with live reload
    ${c.green}mdeck present${c.reset} <slides.md>              Open speaker/presenter view
    ${c.green}mdeck new${c.reset}                              Interactive deck scaffolding wizard
    ${c.green}mdeck build${c.reset} <slides.md> [-o out.html] [--inline-images]
                                              Build self-contained HTML
    ${c.green}mdeck preview${c.reset}                          Preview the last build

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
  const inlineImages = hasFlag('--inline-images', '-I')

  const outputFlagIdx = argv.findIndex(a => a === '--output' || a === '-o')
  const outputPath = outputFlagIdx !== -1 ? resolve(process.cwd(), argv[outputFlagIdx + 1]) : null

  const tempDir = outputPath ? mkdtempSync(resolve(tmpdir(), 'mdeck-')) : null
  const outDir = tempDir ?? resolve(process.cwd(), 'dist')

  await build({
    ...baseConfig(input),
    plugins: [preact(), slidesPlugin(resolve(input), { inlineImages }), viteSingleFile()],
    build: {
      outDir,
      emptyOutDir: !tempDir,
      target: 'esnext',
      assetsInlineLimit: 100 * 1024 * 1024,
    },
  })

  if (!inlineImages) {
    await copyImages(input, outputPath ? dirname(outputPath) : outDir)
  }

  if (outputPath && tempDir) {
    copyFileSync(resolve(tempDir, 'index.html'), outputPath)
    await rm(tempDir, { recursive: true })
    ok(`Built: ${c.cyan}${outputPath}${c.reset}${inlineImages ? ' (images inlined)' : ''}\n`)
  } else {
    ok(`Built: ${c.cyan}${resolve(outDir, 'index.html')}${c.reset}${inlineImages ? ' (images inlined)' : ''}\n`)
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
