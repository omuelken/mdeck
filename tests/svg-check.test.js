import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { svgProblems } from '../src/build/svgCheck.js'
import { checkDeck } from '../src/build/check.js'
import { loadRegistry } from '../src/extensions/discover.js'

const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${body}</svg>`
const codes = markup => svgProblems(markup).map(problem => problem.code)

test('a drawing that follows the palette, with fallbacks and its own classes, is fine', () => {
  const markup = svg(`<!-- uses var(--accent) and fill="#000" -->
    <style>.fl-box { fill: var(--surface, #eee); stroke: var(--accent, #00f) } .fl-box text { fill: currentColor }
    @media (min-width: 10px) { .fl-t { color: var(--ink, #111) } } @keyframes fl-pulse { from { opacity: 0 } to { opacity: 1 } }</style>
    <defs><marker id="head"><path fill="context-stroke" d="M0 0"/></marker></defs>
    <g class="fl-box" data-step="1" data-hotspot><rect fill="url(#head)" stroke="none" fill-opacity="0.5"/></g><g data-step="2" style="fill: var(--ink, #000)"/>`)
  assert.deepEqual(svgProblems(markup), [])
  // A picture without the palette is a picture: its colours are its own.
  assert.deepEqual(codes(svg('<rect fill="#333"/>')), [])
})

test('missing fallbacks, fixed colours and page-wide rules are named', () => {
  const problems = svgProblems(svg(`<style>text { font: 20px serif } .ok { stroke: #222 } svg .x, #y { fill: var(--ink) }</style>
    <rect fill="#333" stroke="var(--accent)"/><stop stop-color='white'/><g style="color: rgb(0, 0, 0)"/>`))
  assert.deepEqual(problems.map(p => p.code), ['svg-fallback', 'svg-fixed-colour', 'svg-style'])
  assert.match(problems[0].message, /var\(--ink\), var\(--accent\) without a fallback/)
  assert.match(problems[1].message, /4 fixed colours \(fill="#333", stop-color="white", stroke="#222"\)/)
  assert.match(problems[2].message, /\(text, svg \.x, #y\)/)
})

test('steps and hotspots need the drawing in the page; numbered and bare steps do not mix', () => {
  assert.deepEqual(codes(svg('<g data-step="1"><rect fill="#333"/></g>')), ['svg-not-inline'])
  assert.deepEqual(codes(svg('<g data-hotspot/>')), ['svg-not-inline'])
  assert.deepEqual(codes(svg('<g data-step="1" fill="var(--ink, #000)"/><g data-step/>')), ['svg-steps'])
})

test('check reports a drawing at the line that shows it', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'mdeck-svg-check-'))
  writeFileSync(resolve(dir, 'flow.svg'), svg('<rect fill="var(--ink)"/>'))
  writeFileSync(resolve(dir, 'plain.svg'), svg('<rect fill="#333"/>'))
  const deck = resolve(dir, 'talk.md')
  const source = '---\ntheme: neue\n---\n\n---\n# A\n\n![Plain](./plain.svg)\n\n---\n# B\n\n![Flow](./flow.svg)\n'
  writeFileSync(deck, source)
  const { diagnostics } = checkDeck(deck, loadRegistry(deck), source)
  assert.deepEqual(diagnostics.map(d => [d.severity, d.code, d.line]), [['warning', 'svg-fallback', 13]])
  assert.match(diagnostics[0].message, /^\.\/flow\.svg uses var\(--ink\)/)
})
