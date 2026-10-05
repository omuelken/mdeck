import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { parseManifestText, validateManifest, ManifestError } from '../src/extensions/manifest.js'
import { loadRegistry, discoverExtensions, extensionRoots, manifestsOf, serializeRegistry, templateManifests } from '../src/extensions/discover.js'
import { buildAppearance, effectiveToken, DARK_TOKENS } from '../src/extensions/appearance.js'
import { resolveLayoutProps } from '../src/layouts/layoutProps.js'
import { parseSlides } from '../src/core/parseSlides.js'
import { validateDeck } from '../src/core/validateDeck.js'
import { generateExtensionsModule } from '../src/build/slidesPlugin.js'

const path = 'examples/custom-layouts/slides.md'
const registry = loadRegistry(path)
const layouts = manifestsOf(registry, 'layout')
const exists = () => true

function fixture(files) {
  const dir = mkdtempSync(resolve(tmpdir(), 'mdeck-ext-'))
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(resolve(dir, name, '..'), { recursive: true })
    writeFileSync(resolve(dir, name), content)
  }
  writeFileSync(resolve(dir, 'slides.md'), '# Hello')
  return { dir, slides: resolve(dir, 'slides.md'), remove: () => rmSync(dir, { recursive: true, force: true }) }
}

const PALETTE = 'schema = 1\nkind = "palette"\nid = "ocean"\ntitle = "Ocean"\ndark = true\n[tokens]\n"--bg" = "#102030"\n"--accent" = "#ffbd69"\n'
const THEME = 'schema = 1\nkind = "theme"\nid = "plain"\ntitle = "Plain"\nfonts = ["https://example.test/font.css"]\n[tokens]\n"--bg" = "#fff"\n"--accent" = "#123456"\n[params.primaryColor]\ntoken = "--accent"\ntitle = "Primary"\n'
const LAYOUT_TOML = 'schema = 1\nkind = "layout"\nid = "box"\ntitle = "Box"\n[regions.body]\n[properties.size]\ntype = "integer"\nminimum = 1\ndefault = 2\n'
const LAYOUT = "import { h } from 'preact'\nimport { MarkdownRegion } from 'mdeck/layout'\nexport default ({ regions }) => <MarkdownRegion class=\"slide-body\" region={regions.body} />\n"

test('manifests of every kind normalize to shared records', () => {
  const palette = validateManifest(parseManifestText(PALETTE, 'p.toml'), { file: 'p.toml', dir: '/x/ocean', folderName: 'ocean', fileExists: exists })
  assert.deepEqual(palette.manifest, { id: 'ocean', title: 'Ocean', description: '', dark: true, tokens: { '--bg': '#102030', '--accent': '#ffbd69' } })
  const theme = validateManifest(parseManifestText(THEME, 't.toml'), { file: 't.toml', dir: '/x/plain', folderName: 'plain', fileExists: exists })
  assert.equal(theme.manifest.params.primaryColor.default, '#123456', 'param defaults derive from tokens')
  assert.deepEqual(theme.files.styles, ['/x/plain/styles.css'])
  const template = validateManifest(parseManifestText(LAYOUT_TOML, 'e.toml'), { file: 'e.toml', dir: '/x/box', folderName: 'box', fileExists: exists })
  assert.equal(template.manifest.frame, 'standard')
  assert.equal(template.files.layout, '/x/box/layout.jsx')
  assert.deepEqual(template.manifest.properties.size, { type: 'integer', minimum: 1, default: 2 })
})

test('common manifest mistakes fail with the file, setting path and reason', () => {
  const caught = fn => { try { fn() } catch (error) { return error } assert.fail('expected a ManifestError') }
  const check = (text, pattern, options = {}) => {
    const error = caught(() => validateManifest(parseManifestText(text, 'extension.toml'), { file: 'extension.toml', dir: '/x/ocean', folderName: text.match(/^id = "([^"]+)"/m)?.[1] ?? 'ocean', fileExists: exists, ...options }))
    assert.ok(error instanceof ManifestError, error.message)
    assert.match(error.message, /^extension\.toml/)
    assert.match(error.message, pattern)
  }
  check(PALETTE.replace('schema = 1', 'schema = 2'), /schema: schema must be 1/)
  check(PALETTE.replace('schema = 1\n', ''), /add "schema = 1"/)
  check(PALETTE.replace('kind = "palette"', 'kind = "colours"'), /kind must be one of/)
  check(PALETTE.replace('id = "ocean"', 'id = "Ocean"'), /id: id must use lowercase/)
  check(PALETTE, /must match the folder name "sea"/, { folderName: 'sea' })
  check(PALETTE.replace('title = "Ocean"', 'name = "Ocean"'), /name is not a setting/)
  check(PALETTE.replace('[tokens]', 'fonts = []\n[tokens]'), /fonts: Unknown setting for a palette/)
  check(PALETTE.replace('"--bg"', '"bg"'), /tokens.bg: token names look like/)
  check(PALETTE.replace('[tokens]\n', '[tokens]\n"--ink" = 3\n'), /tokens.--ink: token values are CSS text/)
  check(THEME.replace('token = "--accent"', 'token = "--missing"'), /params.primaryColor.token: token must name an entry of \[tokens\]/)
  check(THEME + '[files]\nstyles = "../other.css"\n', /files.styles: "\.\.\/other.css" leaves the extension folder/)
  check(THEME + '[files]\nstyles = "missing.css"\n', /files.styles: "missing.css" does not exist/, { fileExists: () => false })
  check(LAYOUT_TOML.replace('[regions.body]\n', ''), /regions must include a \[regions.body\]/)
  check(LAYOUT_TOML.replace('type = "integer"', 'type = "banana"'), /properties.size.type: type must be one of/)
  check(LAYOUT_TOML.replace('default = 2', 'default = "two"'), /properties.size: default must be integer/)
  check(LAYOUT_TOML.replace('default = 2', 'default = 0'), /default must be at least 1/)
  check(LAYOUT_TOML.replace('title = "Box"', 'title = "Box"\nframe = "poster"'), /frame must be one of/)
  check(LAYOUT_TOML, /files.layout: layout.jsx is missing/, { fileExists: () => false })
  const parseError = caught(() => parseManifestText('id = \n', 'broken.toml'))
  assert.ok(parseError instanceof ManifestError)
  assert.match(parseError.message, /^broken\.toml:1:\d+: /)
})

test('built-in and deck-local extensions load through one registry', () => {
  assert.deepEqual(Object.keys(registry.themes), ['aurora', 'duet', 'editorial', 'fhnw', 'neue', 'terminal'])
  assert.equal(Object.keys(registry.palettes).length, 8)
  assert.equal(registry.layouts.comparison.source, 'local')
  assert.equal(registry.layouts.title.source, 'built-in')
  assert.deepEqual(registry.warnings, [])
  assert.ok(registry.layouts.comparison.files.styles[0].endsWith('styles.css'))
  for (const manifest of Object.values(layouts)) {
    assert.deepEqual(validateDeck(parseSlides(manifest.starter), { layouts }), [], manifest.id)
  }
  assert.equal(registry.themes.neue.manifest.tokens['--accent'], '#0d9488', 'theme tokens reflect the rendered CSS, not stale metadata')
  assert.equal(registry.themes.neue.manifest.params.primaryColor.default, '#0d9488')
  assert.equal(registry.themes.terminal.manifest.dark, true)
  assert.equal(registry.themes.aurora.manifest.accent2, true)
  const listing = serializeRegistry(registry, { relativeTo: process.cwd() })
  assert.equal(listing.layouts.find(t => t.id === 'comparison').file, 'examples/custom-layouts/extensions/comparison/extension.toml')
  assert.ok(listing.themes.every(t => t.kind === 'theme' && t.tokens && t.params))
  assert.deepEqual(Object.keys(templateManifests(path)), Object.keys(layouts))
})

test('the generated runtime module imports every layout and lazily loads theme styles', () => {
  const code = generateExtensionsModule(registry)
  assert.match(code, /import L\d+ from ".*\/extensions\/comparison\/layout\.jsx"/)
  assert.match(code, /import ".*\/comparison\/styles\.css"/)
  assert.match(code, /"neue": \{ manifest: \{.*"tokens".*load: \(\) => Promise\.all\(\[import\(".*\/themes\/neue\/styles\.css\?inline"\)\]\)/)
  assert.match(code, /export const palettes = \{\n"dark-ember"/)
})

test('template validation rejects missing regions, unknown props and incorrect values', () => {
  const source = ':::meta\nlayout: comparison\nprops:\n  ratio: [1, 0]\n  emphasis: purple\n  typo: true\n:::\n:::slot wrong\nContent\n:::'
  const diagnostics = validateDeck(parseSlides(source), { layouts })
  for (const code of ['missing-region', 'unknown-region', 'invalid-property', 'unknown-property']) assert.ok(diagnostics.some(d => d.code === code), code)
  assert.ok(diagnostics.some(d => d.message.includes('props.ratio[1]')))
})

test('deck checks agree with the registry about themes, palettes and parameters', () => {
  const options = { layouts, themes: manifestsOf(registry, 'theme'), palettes: manifestsOf(registry, 'palette') }
  const codes = validateDeck(parseSlides('---\ntheme: nope\npalette: nada\nparams:\n  primaryColor: "#000"\n---\n# Hi'), options).map(d => d.code)
  assert.deepEqual(codes, ['unknown-theme', 'unknown-palette'])
  const warnings = validateDeck(parseSlides('---\ntheme: terminal\nparams:\n  fontBody: serif\n---\n# Hi'), options)
  assert.deepEqual(warnings.map(d => [d.code, d.severity]), [['unknown-param', 'warning']])
  assert.deepEqual(validateDeck(parseSlides('---\ntheme: duet\npalette: sage\n---\n# Hi'), options), [])
})

test('defaults are typed, isolated per slide and support legacy image fields', () => {
  const one = resolveLayoutProps(layouts.comparison)
  one.ratio[0] = 100
  assert.deepEqual(resolveLayoutProps(layouts.comparison).ratio, [1, 1])
  assert.equal(resolveLayoutProps(layouts['image-text'], { image: 'legacy.jpg' }).image, 'legacy.jpg')
  assert.equal(resolveLayoutProps(layouts['image-text'], { image: 'legacy.jpg', props: { image: 'new.jpg' } }).image, 'new.jpg')
})

test('deck-local extensions may be grouped in folders and add themes and palettes', () => {
  const fx = fixture({
    'extensions/colors/ocean/extension.toml': PALETTE,
    'extensions/plain/extension.toml': THEME, 'extensions/plain/styles.css': '.slide { color: red }',
    'extensions/box/extension.toml': LAYOUT_TOML, 'extensions/box/layout.jsx': LAYOUT,
  })
  try {
    const local = loadRegistry(fx.slides)
    assert.equal(local.palettes.ocean.source, 'local')
    assert.equal(local.themes.plain.files.styles.length, 1)
    assert.equal(local.layouts.box.manifest.starter, ':::meta\nlayout: box\n:::\n')
    assert.deepEqual(local.warnings, [])
  } finally { fx.remove() }
})

test('duplicate identifiers are rejected across discovery roots instead of overriding', () => {
  const fx = fixture({ 'extensions/paper/extension.toml': PALETTE.replace('ocean', 'paper').replace('Ocean', 'Paper') })
  try {
    assert.throws(() => loadRegistry(fx.slides), /Duplicate palette "paper" is also defined in .*assets\/extensions\/palettes\/paper\/extension\.toml/)
  } finally { fx.remove() }
})

test('appearance precedence is theme tokens, palette, params, then explicit accents', () => {
  const theme = registry.themes.duet.manifest
  const palette = registry.palettes.sage.manifest
  const base = buildAppearance({ theme })
  assert.match(base.themeCss, /^:root \{\n  --bg: #f8f8f5;/)
  assert.equal(base.paletteCss, '')
  assert.equal(base.overridesCss, '')
  assert.deepEqual(base.fonts, theme.fonts)
  const full = buildAppearance({ theme, palette, paletteId: 'sage', params: { primaryColor: '#111111', bogus: 1 }, accent: '#222222', accent2: '#333333', meta: { title: 'T "q"' }, offline: true })
  assert.match(full.paletteCss, /--accent: #40798c;/)
  assert.equal(full.overridesCss, ':root {\n  --accent: #222222;\n  --accent-2: #333333;\n  --meta-title: "T \\"q\\"";\n}')
  assert.deepEqual(full.fonts, [])
  assert.deepEqual(full.warnings, ['Theme "duet" has no parameter "bogus"'])
  assert.equal(buildAppearance({ theme, params: { primaryColor: '#111111' } }).overridesCss, ':root {\n  --accent: #111111;\n}')
  const dark = buildAppearance({ theme: registry.themes.terminal.manifest })
  assert.match(dark.paletteCss, /--logo-filter: invert\(1\);/)
  const darkPalette = buildAppearance({ theme, palette: registry.palettes['dark-slate'].manifest })
  assert.ok(Object.keys(DARK_TOKENS).every(token => darkPalette.paletteCss.includes(token)))
  assert.deepEqual(buildAppearance({ theme, paletteId: 'missing' }).warnings, ['Unknown palette "missing"'])

  assert.equal(effectiveToken('--accent', { theme }), '#6d28d9')
  assert.equal(effectiveToken('--accent', { theme, palette }), '#40798c')
  assert.equal(effectiveToken('--accent', { theme, palette, params: { primaryColor: '#010101' } }), '#010101')
  assert.equal(effectiveToken('--accent', { theme, palette, params: { primaryColor: '#010101' }, accent: '#020202' }), '#020202')
  assert.equal(effectiveToken('--accent-2', { theme: registry.themes.aurora.manifest }), '#d946ef', 'preview color stands in for a computed token')
})
