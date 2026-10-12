import test from 'node:test'
import assert from 'node:assert/strict'
import { keyHelp, isHelpKey } from '../src/runtime/helpKeys.js'

// Every key listed, as 'key: label'.
const listed = context => keyHelp(context).flatMap(group => group.keys.map(({ keys, label }) => `${keys.join('/')}: ${label}`))
const titles = context => keyHelp(context).map(group => group.title)

test('the number keys are listed only while the slide has hotspots', () => {
  assert.ok(!titles({ view: 'deck' }).includes('Hotspots'))
  assert.ok(!listed({ view: 'presenter' }).some(line => line.startsWith('1–9')))
  assert.ok(titles({ view: 'deck', hotspots: true }).includes('Hotspots'))
  assert.ok(listed({ view: 'presenter', hotspots: true }).includes('1–9: Zoom to a part of the slide'))
})

test('the presenter view lists its own keys', () => {
  const keys = listed({ view: 'presenter' })
  assert.ok(keys.includes('T: Start or pause the timer'))
  assert.ok(!keys.some(line => line.startsWith('N:')), 'N only opens the notes in the slide-only layout')
  assert.ok(listed({ view: 'presenter', drawer: true }).includes('N: Show or hide the notes'))
  assert.ok(keys.includes('H: Turn hotspots on'))
  assert.ok(listed({ view: 'presenter', hotspots: true }).includes('H: Turn hotspots off'))
  assert.ok(listed({ view: 'presenter', hotspots: false, hotspotSwitch: true }).includes('H: Turn hotspots off'), 'H names the switch, not the slide')
  assert.ok(keys.includes('Home/R: Back to the first slide'))
  assert.ok(!keys.some(line => line.startsWith('End')), 'End does nothing in the presenter view')
  assert.ok(!listed({ view: 'deck' }).some(line => line.startsWith('T:')), 'the timer is the presenter view’s')
})

test('B makes the screen black, and says how to show the slide again', () => {
  assert.ok(listed({ view: 'presenter' }).includes('B/.: Black screen for the audience'))
  assert.ok(listed({ view: 'deck' }).includes('B/.: Black screen for the audience'))
  assert.ok(listed({ view: 'presenter', blank: true }).includes('B/.: Show the slide again'))
})

test('O lists the overview, and its own keys while it is open', () => {
  assert.ok(listed({ view: 'presenter' }).includes('O: All slides, to pick one'))
  assert.ok(titles({ view: 'deck', overview: true }).includes('All slides'))
  assert.ok(!titles({ view: 'deck', overview: true, hotspots: true }).includes('Hotspots'), 'the number keys do nothing in the overview')
})

test('L, F and D only where they work', () => {
  assert.ok(!listed({ view: 'presenter' }).some(line => line.startsWith('L:')))
  assert.ok(listed({ view: 'presenter', languages: true }).includes('L: Next language'))
  assert.ok(!listed({ view: 'deck' }).some(line => line.startsWith('F:')))
  assert.ok(listed({ view: 'deck', fullscreen: true }).includes('F: Full screen'))
  assert.ok(!listed({ view: 'deck', canDraw: false }).some(line => line.startsWith('D:')))
})

test('drawing keys while drawing, with the platform’s command key', () => {
  assert.ok(!titles({ view: 'deck' }).includes('Drawing'))
  assert.ok(listed({ view: 'deck', inking: true }).includes('D: Stop drawing'))
  assert.ok(listed({ view: 'deck', inking: true, mac: true }).includes('⌘ Z: Undo'))
  assert.ok(listed({ view: 'deck', inking: true }).includes('Shift Ctrl Z: Redo'))
  assert.ok(!titles({ view: 'presenter', inking: true }).includes('Drawing'), 'the presenter view passes on only D')
})

test('? opens the help, but not with a modifier', () => {
  assert.equal(isHelpKey({ key: '?' }), true)
  assert.equal(isHelpKey({ key: '?', shiftKey: true }), true)
  assert.equal(isHelpKey({ key: '?', ctrlKey: true }), false)
  assert.equal(isHelpKey({ key: '/' }), false)
})

test('J shows the join code, in the presenter view of a deck that phones join', () => {
  assert.ok(!listed({ view: 'presenter' }).some(line => line.startsWith('J:')), 'no J without polls or reactions')
  assert.ok(listed({ view: 'presenter', join: true }).includes('J: Show the join code over the slide'))
  assert.ok(listed({ view: 'presenter', join: true, joinShown: true }).includes('J: Hide the join code'))
  assert.ok(!listed({ view: 'deck', join: true }).some(line => line.startsWith('J:')), 'J is the presenter view’s')
})
