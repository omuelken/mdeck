import test from 'node:test'
import assert from 'node:assert/strict'
import { paramValue, paramRange, paramKind, paramSettingProblems } from '../src/extensions/params.js'
import { parseManifestText, validateManifest, ManifestError } from '../src/extensions/manifest.js'
import { loadRegistry, manifestsOf } from '../src/extensions/discover.js'
import { buildAppearance } from '../src/extensions/appearance.js'
import { parseSlides } from '../src/core/parseSlides.js'
import { validateDeck } from '../src/core/validateDeck.js'
import { toModel, toToml, toRuntimeManifest } from '../src/editor/extensions.js'

const registry = loadRegistry('examples/custom-layouts/slides.md')
const themes = manifestsOf(registry, 'theme')
const options = { layouts: manifestsOf(registry, 'layout'), themes, palettes: manifestsOf(registry, 'palette') }

const THEME = `schema = 1
kind = "theme"
id = "zine"
title = "Zine"
palette = "lagoon"
[tokens]
"--bar" = "12px"
"--grain" = "0.5"
"--shapes" = "1"
"--side" = "left"
[params.bar]
token = "--bar"
type = "size"
min = 0
max = 20
[params.grain]
token = "--grain"
type = "number"
min = 0
max = 1
[params.shapes]
token = "--shapes"
type = "switch"
[params.side]
token = "--side"
type = "choice"
choices = ["left", "right"]
`
const load = text => validateManifest(parseManifestText(text, 'extension.toml'), { file: 'extension.toml', dir: '/x/zine', folderName: 'zine', fileExists: () => true })

test('a typed value becomes CSS, or says why it cannot', () => {
  const size = { type: 'size', min: 6, max: 20 }
  assert.deepEqual(paramValue(size, '12px'), { value: '12px' })
  assert.deepEqual(paramValue(size, 12), { value: '12px' }, 'a number is pixels')
  assert.deepEqual(paramValue(size, ' 8 '), { value: '8px' })
  assert.deepEqual(paramValue(size, '0'), { value: '0px', note: 'is made for 6px to 20px' }, 'outside the range: used, with a note')
  assert.match(paramValue(size, '1em').problem, /a size in pixels/)
  assert.match(paramValue(size, 'thick').problem, /a size in pixels/)
  const number = { type: 'number', min: 0, max: 1 }
  assert.deepEqual(paramValue(number, 0.25), { value: '0.25' })
  assert.deepEqual(paramValue(number, '.5'), { value: '0.5' })
  assert.match(paramValue(number, 'lots').problem, /a number/)
  const flag = { type: 'switch' }
  for (const on of [1, '1', true, 'on', 'yes']) assert.deepEqual(paramValue(flag, on), { value: '1' })
  for (const off of [0, '0', false, 'off', 'No']) assert.deepEqual(paramValue(flag, off), { value: '0' })
  assert.match(paramValue(flag, 'none').problem, /1 or 0/)
  const choice = { type: 'choice', choices: ['left', 'right'] }
  assert.deepEqual(paramValue(choice, 'right'), { value: 'right' })
  assert.match(paramValue(choice, 'middle').problem, /one of: left, right/)
  assert.deepEqual(paramValue({ type: 'font' }, 'Georgia, serif'), { value: 'Georgia, serif' })
  assert.deepEqual(paramValue({}, 'anything at all'), { value: 'anything at all' }, 'without a type, any text, as before')
  assert.match(paramValue(size, { a: 1 }).problem, /a single value/)
  assert.equal(paramRange({ type: 'number', min: 0 }), 'at least 0')
  assert.equal(paramRange({ type: 'size' }), '')
  assert.equal(paramKind({ type: 'size', min: 0, max: 48 }), ' (size, 0px to 48px)')
  assert.equal(paramKind({ type: 'switch' }), ' (1 or 0)')
  assert.equal(paramKind(choice), ' (left, right)')
  assert.equal(paramKind({}), '')
})

test('a manifest keeps typed settings and checks them, its default included', () => {
  const { params } = load(THEME).manifest
  assert.deepEqual(params.bar, { token: '--bar', default: '12px', type: 'size', min: 0, max: 20 })
  assert.deepEqual(params.side, { token: '--side', default: 'left', type: 'choice', choices: ['left', 'right'] })
  const fails = (text, pattern) => assert.throws(() => load(text), error => error instanceof ManifestError && pattern.test(error.message))
  fails(THEME.replace('type = "size"', 'type = "length"'), /params.bar.type: must be one of: size, number, switch, choice, font/)
  fails(THEME.replace('"--bar" = "12px"', '"--bar" = "0.8em"'), /params.bar.type: the token's value "0.8em" is a size in pixels/)
  fails(THEME.replace('"--bar" = "12px"', '"--bar" = "30px"'), /params.bar.type: the token's value "30px" lies outside 0px to 20px/)
  fails(THEME.replace('"--shapes" = "1"', '"--shapes" = "block"'), /params.shapes.type: the token's value "block" is a switch: 1 or 0/)
  fails(THEME.replace('"--shapes" = "1"', '"--shapes" = "on"'), /params.shapes.type: write the token's value as "1"/)
  fails(THEME.replace('choices = ["left", "right"]\n', ''), /params.side.choices: a choice needs a list of its values/)
  fails(THEME.replace('choices = ["left", "right"]', 'choices = ["left", "left"]'), /params.side.choices: lists a value twice/)
  fails(THEME.replace('min = 0\nmax = 20', 'min = 20\nmax = 0'), /params.bar.max: must not be less than min/)
  fails(THEME.replace('min = 0\nmax = 20', 'min = "0px"'), /params.bar.min: must be a number of pixels/)
  fails(THEME.replace('type = "switch"', 'type = "switch"\nmax = 1'), /params.shapes.max: is for a size or a number, not a switch/)
  fails(THEME.replace('token = "--bar"\ntype = "size"\n', 'token = "--bar"\n'), /params.bar.min: needs a type/)
  fails(THEME.replace('type = "switch"', 'type = "switch"\nunit = "px"'), /params.shapes.unit: Unknown parameter setting/)
  assert.deepEqual(paramSettingProblems({ token: '--x' }, 'anything'), [], 'an untyped parameter takes any default')
})

test('every built-in theme gives its parameters a type', () => {
  // The example deck has no themes of its own: these are mdeck's.
  for (const theme of Object.values(themes)) {
    for (const [name, param] of Object.entries(theme.params)) assert.ok(param.type, `${theme.id}: params.${name} has no type`)
  }
})

test('the slides use a typed value as CSS and leave out one that does not fit', () => {
  const theme = load(THEME).manifest
  const look = buildAppearance({ theme, params: { bar: 8, grain: '0.2', shapes: false, side: 'middle' } })
  assert.match(look.overridesCss, /--bar: 8px;/)
  assert.match(look.overridesCss, /--grain: 0.2;/)
  assert.match(look.overridesCss, /--shapes: 0;/)
  assert.doesNotMatch(look.overridesCss, /--side/)
  assert.deepEqual(look.warnings, ["params.side must be one of: left, right; the theme's left is used"])
})

test('mdeck check warns about a value that does not fit, and one outside the range', () => {
  const work = themes.work
  assert.equal(work.params.band.type, 'size')
  const check = params => validateDeck(parseSlides(`---\ntheme: work\nparams:\n${params}\n---\n# Hi`), options)
  assert.deepEqual(check('  band: 20px'), [])
  assert.deepEqual(check('  band: 0'), [], '0 is 0px: no band')
  const [bad] = check('  band: thick')
  assert.deepEqual([bad.code, bad.severity], ['invalid-param', 'warning'])
  assert.match(bad.message, /^params.band is a size in pixels, such as 12px; the theme's 14px is used instead$/)
  assert.match(check('  band: 90px')[0].message, /^params.band is made for 0px to 32px; 90px may not look right$/)
})

test('the theme form keeps a parameter\'s type, range and choices', () => {
  const model = toModel(parseManifestText(THEME, 'extension.toml'))
  const again = parseManifestText(toToml(model), 'extension.toml')
  assert.deepEqual({ ...again.params.bar }, { token: '--bar', type: 'size', min: 0, max: 20 })
  assert.deepEqual({ ...again.params.side, choices: [...again.params.side.choices] }, { token: '--side', type: 'choice', choices: ['left', 'right'] })
  const runtime = toRuntimeManifest(model)
  assert.deepEqual(runtime.params.shapes, { token: '--shapes', type: 'switch', default: '1' })
  // Without a type, range and choices are not written.
  const untyped = toModel(parseManifestText(THEME, 'extension.toml'))
  untyped.params = untyped.params.map(param => param.name === 'bar' ? { ...param, type: undefined } : param)
  assert.deepEqual({ ...parseManifestText(toToml(untyped), 'extension.toml').params.bar }, { token: '--bar' })
})
