import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { parseManifestText, validateManifest, ManifestError } from '../src/extensions/manifest.js'
import { loadRegistry, discoverExtensions, extensionRoots, manifestsOf, serializeRegistry, layoutManifests } from '../src/extensions/discover.js'
import { buildAppearance, paletteColor, DARK_TOKENS } from '../src/extensions/appearance.js'
import { resolveLayoutProps } from '../src/layouts/layoutProps.js'
import { parseSlides } from '../src/core/parseSlides.js'
import { validateDeck } from '../src/core/validateDeck.js'
import { generateExtensionsModule, deckLookOnly } from '../src/build/slidesPlugin.js'

const path = 'examples/custom-layouts/slides.md'
const registry = loadRegistry(path)
// Stand-ins for kinds of themes: one that offers only its own palette, one
// that starts dark.
const house = loadRegistry('tests/fixtures/house/slides.md', { userRoot: null })
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

const PALETTE = 'schema = 1\nkind = "palette"\nid = "ocean"\ntitle = "Ocean"\n[light]\n"--bg" = "#f4f8fb"\n"--surface" = "#e6eef4"\n"--ink" = "#0b1d2a"\n"--ink-soft" = "#22394a"\n"--muted" = "#4f6474"\n"--rule" = "#c9d7e2"\n"--accent" = "#0a6aa8"\n"--accent-2" = "#b45309"\n"--on-accent" = "#ffffff"\n[dark]\n"--bg" = "#102030"\n"--surface" = "#17293b"\n"--ink" = "#eef4f8"\n"--ink-soft" = "#c8d6e0"\n"--muted" = "#8ea3b3"\n"--rule" = "#24384b"\n"--accent" = "#ffbd69"\n"--accent-2" = "#7cc4ff"\n"--on-accent" = "#102030"\n'
const THEME = 'schema = 1\nkind = "theme"\nid = "plain"\ntitle = "Plain"\npalette = "lagoon"\nfonts = ["https://example.test/font.css"]\n[tokens]\n"--font-body" = "serif"\n[params.fontBody]\ntoken = "--font-body"\ntitle = "Body font"\n'
const LAYOUT_TOML = 'schema = 1\nkind = "layout"\nid = "box"\ntitle = "Box"\n[regions.body]\n[properties.size]\ntype = "integer"\nminimum = 1\ndefault = 2\n'
const LAYOUT = "import { h } from 'preact'\nimport { MarkdownRegion } from 'mdeck/layout'\nexport default ({ regions }) => <MarkdownRegion class=\"slide-body\" region={regions.body} />\n"

test('manifests of every kind normalize to shared records', () => {
  const palette = validateManifest(parseManifestText(PALETTE, 'p.toml'), { file: 'p.toml', dir: '/x/ocean', folderName: 'ocean', fileExists: exists })
  assert.equal(palette.manifest.light['--bg'], '#f4f8fb')
  assert.equal(palette.manifest.dark['--accent'], '#ffbd69')
  assert.equal(palette.manifest.theme, undefined, 'offered to every theme')
  const theme = validateManifest(parseManifestText(THEME, 't.toml'), { file: 't.toml', dir: '/x/plain', folderName: 'plain', fileExists: exists })
  assert.equal(theme.manifest.palette, 'lagoon')
  assert.equal(theme.manifest.appearance, 'light')
  assert.equal(theme.manifest.params.fontBody.default, 'serif', 'param defaults derive from tokens')
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
  check(PALETTE.replace('[light]', 'fonts = []\n[light]'), /fonts: Unknown setting for a palette/)
  check(PALETTE.replace('"--bg"', '"bg"'), /light.bg: token names look like/)
  check(PALETTE.replace('[light]\n', '[light]\n"--extra" = 3\n'), /light.--extra: token values are CSS text/)
  check(PALETTE.replace('"--on-accent" = "#ffffff"\n', ''), /light: missing colours: --on-accent/)
  check(PALETTE.slice(0, PALETTE.indexOf('[dark]')), /dark: a \[dark\] table with the dark colours is required/)
  check(PALETTE.replace('[light]', '[tokens]\n"--bg" = "#fff"\n[light]'), /tokens: a palette has a \[light\] and a \[dark\] table/)
  check(THEME.replace('palette = "lagoon"\n', ''), /palette: palette must name the palette this theme uses by default/)
  check(THEME.replace('[tokens]\n', '[tokens]\n"--accent" = "#123456"\n'), /tokens.--accent: --accent is a colour; colours come from the palette/)
  check(THEME.replace('palette = "lagoon"', 'palette = "lagoon"\ndark = true'), /dark: dark is now appearance = "dark"/)
  check(THEME.replace('palette = "lagoon"', 'palette = "lagoon"\npalettes = ["swiss"]'), /palettes: palettes must include the default palette "lagoon"/)
  check(THEME.replace('token = "--font-body"', 'token = "--missing"'), /params.fontBody.token: token must name an entry of \[tokens\]/)
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
  assert.deepEqual(Object.keys(registry.themes), ['academic', 'aurora', 'minimal', 'neue'])
  assert.deepEqual(Object.keys(registry.palettes), ['lagoon', 'neon', 'nordic', 'paper', 'swiss'])
  assert.equal(registry.layouts.comparison.source, 'local')
  assert.equal(registry.layouts.title.source, 'built-in')
  assert.deepEqual(registry.warnings, [])
  assert.ok(registry.layouts.comparison.files.styles[0].endsWith('styles.css'))
  for (const manifest of Object.values(layouts)) {
    assert.deepEqual(validateDeck(parseSlides(manifest.starter), { layouts }), [], manifest.id)
  }
  assert.equal(registry.themes.neue.manifest.palette, 'swiss')
  assert.equal(house.themes.night.manifest.appearance, 'dark')
  assert.deepEqual(house.themes.house.manifest.palettes, ['house-colours'])
  assert.equal(house.palettes['house-colours'].manifest.theme, 'house')
  const listing = serializeRegistry(registry, { relativeTo: process.cwd() })
  assert.equal(listing.layouts.find(t => t.id === 'comparison').file, 'examples/custom-layouts/extensions/comparison/extension.toml')
  assert.ok(listing.themes.every(t => t.kind === 'theme' && t.tokens && t.params))
  assert.deepEqual(Object.keys(layoutManifests(path)), Object.keys(layouts))
})

test('the generated runtime module imports every layout and lazily loads theme styles', () => {
  const code = generateExtensionsModule(registry)
  assert.match(code, /import L\d+ from ".*\/extensions\/comparison\/layout\.jsx"/)
  assert.match(code, /import ".*\/comparison\/styles\.css"/)
  assert.match(code, /"neue": \{ manifest: \{.*"tokens".*load: \(\) => Promise\.all\(\[import\(".*\/packs\/neue\/neue\/styles\.css\?inline"\)\]\)/)
  assert.match(code, /export const palettes = \{\n"lagoon"/)
})

test('a file for readers carries only the deck theme and the palette it shows', () => {
  const pick = config => { const only = deckLookOnly(registry, config); return [Object.keys(only.themes), Object.keys(only.palettes)] }
  const pickHouse = config => { const only = deckLookOnly(house, config); return [Object.keys(only.themes), Object.keys(only.palettes)] }
  assert.deepEqual(pick({ theme: 'academic' }), [['academic'], ['nordic']], "the theme's default palette")
  assert.deepEqual(pick({ theme: 'aurora', palette: 'lagoon' }), [['aurora'], ['lagoon']], "the deck's own palette")
  assert.deepEqual(pick({}), [['neue'], ['swiss']], 'neue without a theme')
  assert.deepEqual(pickHouse({ theme: 'house', palette: 'lagoon' }), [['house'], ['house-colours']], 'a palette the theme does not offer falls back')
  assert.equal(Object.keys(deckLookOnly(registry, { theme: 'academic' }).layouts).length, Object.keys(registry.layouts).length, 'layouts stay')
  assert.doesNotMatch(generateExtensionsModule(deckLookOnly(registry, { theme: 'academic' })), /neue\/neue\/styles\.css/)
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
  const removed = validateDeck(parseSlides('---\ntheme: neue\naccent: "#123456"\nappearance: dim\n---\n# Hi'), options)
  assert.deepEqual(removed.map(d => [d.code, d.severity]), [['removed-setting', 'error'], ['invalid-config', 'error']])
  const houseOptions = { layouts, themes: manifestsOf(house, 'theme'), palettes: manifestsOf(house, 'palette') }
  const foreign = validateDeck(parseSlides('---\ntheme: house\npalette: lagoon\n---\n# Hi'), houseOptions)
  assert.match(foreign[0].message, /The theme "house" does not offer the palette "lagoon"; available: house-colours/)
  const warnings = validateDeck(parseSlides('---\ntheme: night\nparams:\n  fontBody: serif\n---\n# Hi'), houseOptions)
  assert.deepEqual(warnings.map(d => [d.code, d.severity]), [['unknown-param', 'warning']])
  assert.deepEqual(validateDeck(parseSlides('---\ntheme: aurora\npalette: paper\nappearance: dark\n---\n# Hi'), options), [])
  // Themes and palettes that moved to the theme repository say how to get them.
  const moved = validateDeck(parseSlides('---\ntheme: duet\npalette: forest\n---\n# Hi'), options)
  assert.deepEqual(moved.map(d => d.code), ['unknown-theme', 'unknown-palette'])
  assert.match(moved[0].message, /no longer built into mdeck; .*mdeck themes install duet$/)
  assert.match(moved[1].message, /mdeck themes install earth$/)
  // Palettes removed for a near twin say which one to use.
  const replaced = validateDeck(parseSlides('---\ntheme: neue\npalette: graphite\n---\n# Hi'), options)
  assert.match(replaced[0].message, /"graphite" was removed from mdeck; use palette: nordic/)
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

test("a deck's own theme or palette replaces the one that comes with mdeck; layouts and one place may not repeat an id", () => {
  const fx = fixture({ 'extensions/swiss/extension.toml': PALETTE.replace('ocean', 'swiss').replace('Ocean', 'My swiss') })
  try {
    const local = loadRegistry(fx.slides, { userRoot: null })
    assert.equal(local.palettes.swiss.source, 'local')
    assert.equal(local.palettes.swiss.title, 'My swiss')
  } finally { fx.remove() }
  const twice = fixture({ 'extensions/a/swiss/extension.toml': PALETTE.replace('ocean', 'swiss'), 'extensions/b/swiss/extension.toml': PALETTE.replace('ocean', 'swiss') })
  try {
    assert.throws(() => loadRegistry(twice.slides, { userRoot: null }), /Duplicate palette "swiss" is also defined in .*extensions\/a\/swiss\/extension\.toml/)
  } finally { twice.remove() }
  const layout = fixture({ 'extensions/title/extension.toml': LAYOUT_TOML.replace('id = "box"', 'id = "title"'), 'extensions/title/layout.jsx': LAYOUT })
  try {
    assert.throws(() => loadRegistry(layout.slides, { userRoot: null }), /Duplicate layout "title"/)
  } finally { layout.remove() }
})

test('appearance: the theme default palette, the deck palette and appearance, then params', () => {
  const theme = registry.themes.academic.manifest
  const palettes = manifestsOf(registry, 'palette')
  const base = buildAppearance({ theme, palettes })
  assert.doesNotMatch(base.themeCss, /--bg:/, 'themes carry no colours')
  assert.equal(base.palette, 'nordic')
  assert.match(base.paletteCss, /--accent: #1f6f9f;/)
  assert.match(base.paletteCss, /--inverse-accent: #7cc4ea;/)
  assert.equal(base.overridesCss, '')
  assert.deepEqual(base.fonts, theme.fonts)
  const full = buildAppearance({ theme, palettes, palette: 'paper', appearance: 'dark', params: { fontBody: 'serif', bogus: 1 }, meta: { title: 'T "q"' }, offline: true })
  assert.match(full.paletteCss, /--accent: #fb8c4a;/)
  assert.ok(Object.keys(DARK_TOKENS).every(token => full.paletteCss.includes(token)), 'dark code colours and logo filter')
  assert.equal(full.overridesCss, ':root {\n  --font-body: serif;\n  --meta-title: "T \\"q\\"";\n}')
  assert.deepEqual(full.fonts, [])
  assert.deepEqual(full.warnings, ['Theme "academic" has no parameter "bogus"'])
  assert.match(buildAppearance({ theme: house.themes.night.manifest, palettes }).paletteCss, /--logo-filter: invert\(1\);/)
  assert.match(buildAppearance({ theme, palettes, palette: 'missing' }).warnings[0], /^Unknown palette "missing"/)

  assert.equal(paletteColor('--accent', { theme, palettes }), '#1f6f9f')
  assert.equal(paletteColor('--accent', { theme, palettes, palette: 'paper', appearance: 'dark' }), '#fb8c4a')
})

test('mdeck check warns about a misspelled callout type, but not about known blocks or the deck\'s own', () => {
  const warnings = source => validateDeck(parseSlides(source)).filter(d => d.code === 'unknown-callout').map(d => d.message)
  const [typo] = warnings('---\ntheme: neue\n---\n# A\n\n::: warnign\nCareful\n:::\n')
  assert.match(typo, /Unknown block "warnign"; did you mean "warning"\?/)
  assert.deepEqual(warnings('# A\n\n:::columns\n::: Theorem Satz 1\nx\n:::\n+++\n:::steps\n- a\n:::\n:::\n\n:::notes\nn\n:::\n'), [])
  assert.deepEqual(warnings('---\ncallouts:\n  hint: Hinweis\n---\n# A\n\n::: hint\nx\n:::\n'), [], 'a type with a title under callouts: is intended')
  assert.equal(warnings('# A\n\n```markdown\n::: nonsense\n```\n').length, 0, 'code examples are not blocks')
})
