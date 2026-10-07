import test from 'node:test'
import assert from 'node:assert/strict'
import { loadRegistry, manifestsOf } from '../src/extensions/discover.js'
import { paletteProblems, contrast } from '../src/extensions/contrast.js'
import { buildAppearance, resolvePalette } from '../src/extensions/appearance.js'
import { palettesFor } from '../src/extensions/tokens.js'

const registry = loadRegistry('examples/poll/slides.md', { userRoot: null })
const palettes = manifestsOf(registry, 'palette')
const themes = manifestsOf(registry, 'theme')
// Stand-ins: a theme that offers only its own palette, one that starts dark.
const house = loadRegistry('tests/fixtures/house/slides.md', { userRoot: null })
const housePalettes = manifestsOf(house, 'palette')
const houseThemes = manifestsOf(house, 'theme')

test('every built-in palette can be read, light and dark', () => {
  for (const palette of Object.values(palettes)) assert.deepEqual(paletteProblems(palette), [], palette.id)
})

test('contrast is measured as WCAG does', () => {
  assert.equal(Math.round(contrast('#000', '#fff')), 21)
  assert.equal(contrast('#777777', '#777777'), 1)
})

test('every theme has a default palette it offers, and a theme can offer only its own', () => {
  for (const theme of Object.values(themes)) assert.ok(palettesFor(theme, palettes).some(p => p.id === theme.palette), theme.id)
  assert.deepEqual(palettesFor(houseThemes.house, housePalettes).map(p => p.id), ['house-colours'])
  assert.ok(!palettesFor(houseThemes.neue, housePalettes).some(p => p.id === 'house-colours'), 'house-colours is private to house')
})

test('a deck gets the theme default, its own palette, and the other variant for inverted slides', () => {
  const plain = buildAppearance({ theme: themes.neue, palettes })
  assert.equal(plain.palette, 'swiss')
  assert.equal(plain.appearance, 'light')
  assert.match(plain.paletteCss, /--bg: #ffffff;/)
  assert.match(plain.paletteCss, /--inverse-bg: #0d0d0d;/)
  const dark = buildAppearance({ theme: themes.neue, palettes, palette: 'graphite', appearance: 'dark' })
  assert.match(dark.paletteCss, /--bg: #141414;/)
  assert.match(dark.paletteCss, /--inverse-bg: #fbfaf8;/)
  assert.match(dark.paletteCss, /color-scheme: dark;/)
  assert.equal(buildAppearance({ theme: houseThemes.night, palettes }).appearance, 'dark', 'night starts dark')
})

test('an unknown palette, or one the theme does not offer, falls back to the default with a warning', () => {
  const unknown = resolvePalette({ theme: themes.neue, palettes, palette: 'paper' })
  assert.equal(unknown.palette.id, 'swiss')
  assert.match(unknown.warnings[0], /Unknown palette "paper"/)
  const foreign = resolvePalette({ theme: houseThemes.house, palettes: housePalettes, palette: 'graphite' })
  assert.equal(foreign.palette.id, 'house-colours')
  assert.match(foreign.warnings[0], /does not offer/)
})
