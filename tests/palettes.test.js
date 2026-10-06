import test from 'node:test'
import assert from 'node:assert/strict'
import { loadRegistry, manifestsOf } from '../src/extensions/discover.js'
import { paletteProblems, contrast } from '../src/extensions/contrast.js'
import { buildAppearance, resolvePalette } from '../src/extensions/appearance.js'
import { palettesFor } from '../src/extensions/tokens.js'

const registry = loadRegistry('examples/poll/slides.md')
const palettes = manifestsOf(registry, 'palette')
const themes = manifestsOf(registry, 'theme')

test('every built-in palette can be read, light and dark', () => {
  for (const palette of Object.values(palettes)) assert.deepEqual(paletteProblems(palette), [], palette.id)
})

test('contrast is measured as WCAG does', () => {
  assert.equal(Math.round(contrast('#000', '#fff')), 21)
  assert.equal(contrast('#777777', '#777777'), 1)
})

test('every theme has a default palette it offers, and FHNW offers only its own', () => {
  for (const theme of Object.values(themes)) assert.ok(palettesFor(theme, palettes).some(p => p.id === theme.palette), theme.id)
  assert.deepEqual(palettesFor(themes.fhnw, palettes).map(p => p.id), ['brand'])
  assert.ok(!palettesFor(themes.neue, palettes).some(p => p.id === 'brand'), 'brand is private to fhnw')
})

test('a deck gets the theme default, its own palette, and the other variant for inverted slides', () => {
  const plain = buildAppearance({ theme: themes.neue, palettes })
  assert.equal(plain.palette, 'lagoon')
  assert.equal(plain.appearance, 'light')
  assert.match(plain.paletteCss, /--bg: #f8f8f6;/)
  assert.match(plain.paletteCss, /--inverse-bg: #0e1716;/)
  const dark = buildAppearance({ theme: themes.neue, palettes, palette: 'terra', appearance: 'dark' })
  assert.match(dark.paletteCss, /--bg: #001f30;/)
  assert.match(dark.paletteCss, /--inverse-bg: #fdf0d5;/)
  assert.match(dark.paletteCss, /color-scheme: dark;/)
  assert.equal(buildAppearance({ theme: themes.terminal, palettes }).appearance, 'dark', "terminal starts dark")
})

test('an unknown palette, or one the theme does not offer, falls back to the default with a warning', () => {
  const unknown = resolvePalette({ theme: themes.neue, palettes, palette: 'paper' })
  assert.equal(unknown.palette.id, 'lagoon')
  assert.match(unknown.warnings[0], /Unknown palette "paper"/)
  const foreign = resolvePalette({ theme: themes.fhnw, palettes, palette: 'terra' })
  assert.equal(foreign.palette.id, 'brand')
  assert.match(foreign.warnings[0], /does not offer/)
})
