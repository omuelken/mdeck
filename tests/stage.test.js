import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

// The stage and its feature modules, bundled into one script that each
// fixture runs in a context of its own.
const [{ output: [{ code: stageScript }] }] = await build({
  configFile: false, logLevel: 'silent',
  build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('../src/runtime/deck-stage.js', import.meta.url)), formats: ['iife'], name: 'deckStage' } },
})

// Exercise the real stage state machine without a browser layout engine.
function stageFixture() {
  let Stage
  const messages = []
  const events = []
  const window = { postMessage: message => messages.push(message) }
  window.parent = window
  vm.runInNewContext(stageScript, {
    HTMLElement: class {
      attachShadow() { return {} }
      dispatchEvent(event) { events.push(event) }
      toggleAttribute(name, on) { this[name] = on }
      getAttribute(name) { return this.attributes?.[name] ?? null }
      setAttribute(name, value) { (this.attributes ??= {})[name] = String(value) }
      hasAttribute(name) { return this.attributes?.[name] != null }
      removeAttribute(name) { delete this.attributes?.[name] }
    },
    customElements: { get() {}, define(name, value) { Stage = value } },
    location: { search: '', hash: '' }, history: { replaceState() {} },
    URLSearchParams, window, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail } },
  })
  const stage = new Stage()
  const step = () => ({ dataset: { step: '0' }, getAttribute: () => '0', closest: () => null, setAttribute() { this.visible = true }, removeAttribute() { this.visible = false } })
  stage._slides = ['first', 'second'].map(id => {
    const steps = [step(), step()]
    return { dataset: { slideId: id }, steps, querySelectorAll: () => steps, setAttribute() {}, removeAttribute() {} }
  })
  return { stage, messages, events }
}

test('reveals broadcast state and an audience applies it on the same slide', () => {
  const { stage: presenter, messages } = stageFixture()
  const { stage: audience } = stageFixture()
  presenter.next()
  const state = messages.at(-1).deckStateChanged
  assert.equal(state.step, 0)
  audience.setState(state)
  assert.equal(audience.state.step, 0)
  assert.equal(audience._slides[0].steps[0].visible, true)
  assert.equal(audience._slides[0].steps[1].visible, false)
  presenter.prev()
  audience.setState(messages.at(-1).deckStateChanged)
  assert.equal(audience.state.step, -1)
})

test('reset clears visible reveals even when already on the first slide', () => {
  const { stage } = stageFixture()
  stage.next()
  stage.reset()
  assert.equal(stage.state.step, -1)
  assert.equal(stage._slides[0].steps[0].visible, false)
})

test('state resolves stable IDs and clamps invalid reveal positions', () => {
  const { stage } = stageFixture()
  stage.setState({ index: 0, slideId: 'second', step: 999 })
  assert.equal(stage.index, 1)
  assert.equal(stage.state.step, 1)
  stage.setState({ index: -10, step: 0 })
  assert.equal(stage.index, 1)
})

test('received positions broadcast the final reveal state once with a sync reason', () => {
  const { stage, messages, events } = stageFixture()
  stage.setState({ index: 1, step: 1 })
  const states = messages.filter(message => message.deckStateChanged)
  assert.equal(states.length, 1)
  assert.equal(states[0].deckStateChanged.index, 1)
  assert.equal(states[0].deckStateChanged.step, 1)
  assert.equal(states[0].reason, 'sync')
  assert.equal(events.at(-1).detail.reason, 'sync')
  assert.equal(events.at(-1).detail.step, 1)
  stage.setState({ index: 1, step: 0 })
  assert.equal(messages.at(-1).deckStateChanged.step, 0, 'same-slide reveals reach the presenter sidebar')
  assert.equal(events.at(-1).detail.reason, 'sync')
  const count = messages.length
  stage.setState({ index: 1, step: 0 })
  assert.equal(messages.length, count, 'an unchanged position does not broadcast again')
})

test('a black screen is part of the position, and the next press shows the slide again', () => {
  const { stage: presenter, messages } = stageFixture()
  const { stage: audience } = stageFixture()
  presenter.setBlank(true, 'keyboard')
  assert.equal(presenter.state.blank, true)
  assert.equal(presenter['data-blank'], true)
  const state = messages.at(-1).deckStateChanged
  assert.equal(state.blank, true)
  audience.setState(state)
  assert.equal(audience.blank, true, 'the audience window goes black at the same slide')
  presenter.next()
  assert.equal(presenter.blank, false)
  assert.equal(presenter.state.step, -1, 'showing the slide again does not advance')
  audience.setState(messages.at(-1).deckStateChanged)
  assert.equal(audience.blank, false)
  presenter.next()
  assert.equal(presenter.state.step, 0)
})

test('a position without blank leaves the black screen as it is', () => {
  const { stage, messages } = stageFixture()
  stage.setState({ index: 0, step: -1, blank: true })
  assert.equal(stage.blank, true)
  assert.equal(messages.at(-1).reason, 'sync')
  stage.setState({ index: 1, step: 0 })
  assert.equal(stage.blank, true)
  stage.setState({ index: 1, step: 0, blank: false })
  assert.equal(stage.blank, false)
})

test('a frozen projector keeps its slide while the presenter goes on, and follows again after', () => {
  const { stage: presenter, messages } = stageFixture()
  const { stage: audience } = stageFixture()
  audience.setAttribute('data-freezable', '')
  presenter.next()
  audience.setState(messages.at(-1).deckStateChanged)
  presenter.setFreeze(true, 'keyboard')
  assert.equal(JSON.stringify(presenter.freeze), JSON.stringify({ index: 0, step: 0, slideId: 'first' }))
  assert.equal(presenter['data-frozen'], true)
  audience.setState(messages.at(-1).deckStateChanged)
  assert.equal(JSON.stringify(audience.freeze), JSON.stringify(presenter.freeze))
  presenter.next()
  presenter.next()
  assert.equal(presenter.index, 1, 'the presenter goes on')
  audience.setState(messages.at(-1).deckStateChanged)
  assert.equal(audience.index, 0, 'the audience window keeps the frozen slide')
  assert.equal(audience.state.step, 0)
  audience.next()
  assert.equal(audience.index, 0, 'nor does it page on its own while frozen')
  assert.equal(audience.state.step, 0)
  presenter.setFreeze(false, 'keyboard')
  audience.setState(messages.at(-1).deckStateChanged)
  assert.equal(audience.freeze, null)
  assert.equal(audience.index, 1, 'unfrozen, it goes to the presenter')
})

test('a stage that is not freezable follows a frozen position, and a position without freeze leaves it', () => {
  const { stage } = stageFixture()
  stage.setState({ index: 1, step: -1, freeze: { index: 0, step: -1, slideId: 'first' } })
  assert.equal(stage.index, 1, 'the presenter’s own frames go on')
  assert.equal(stage.freeze.index, 0)
  stage.setState({ index: 0, step: -1 })
  assert.equal(stage.freeze.index, 0)
  stage.setState({ index: 0, step: -1, freeze: null })
  assert.equal(stage.freeze, null)
})

test('print mode reveals every step and restores the positions afterwards', () => {
  const { stage, events } = stageFixture()
  stage.next()
  stage.printing = true
  assert.equal(stage['data-deck-static'], true)
  assert.equal(events.at(-1).type, 'printchange')
  assert.equal(events.at(-1).detail.printing, true)
  assert.ok(stage._slides.every(slide => slide.steps.every(step => step.visible)))
  stage.printing = false
  assert.equal(stage['data-deck-static'], false)
  assert.equal(stage._slides[0].steps[0].visible, true)
  assert.equal(stage._slides[0].steps[1].visible, false)
  assert.equal(stage._slides[1].steps[0].visible, false)
})

// Hotspots, with the zoom's flight recorded instead of drawn.
function hotspotStage(deck = 'auto') {
  const { stage, messages } = stageFixture()
  stage.setAttribute('data-hotspots', deck)
  const flights = []
  stage.flyZoom = (zoom, reason) => { flights.push({ zoom, reason }); stage._zoom = zoom }
  stage._hotspots = [1, 2, 3].map(n => ({ rect: { x: n * 100, y: 0, w: 100, h: 100 }, zoom: { scale: 3, x: n * 100 + 50, y: 50 } }))
  return { stage, flights, messages }
}

test('with hotspots on, digits zoom to them and the same digit, 0 or Escape zooms out', () => {
  const { stage, flights } = hotspotStage()
  const key = k => stage._onKey({ key: k, target: null, preventDefault() {} })
  key('2')
  assert.equal(stage.hotspot, 2)
  assert.deepEqual(flights.at(-1), { zoom: { scale: 3, x: 250, y: 50 }, reason: 'hotspot' })
  key('3')
  assert.equal(stage.hotspot, 3, 'another digit goes straight across')
  key('3')
  assert.equal(stage.hotspot, null)
  assert.deepEqual(flights.at(-1), { zoom: null, reason: 'hotspot-reset' })
  key('1'); key('0')
  assert.equal(stage.hotspot, null)
  key('1'); key('Escape')
  assert.equal(flights.at(-1).zoom, null)
  key('9')
  assert.equal(stage.hotspot, null, 'a digit without a hotspot does nothing')
  assert.equal(stage.index, 0, 'and does not jump to a slide')
})

test('with hotspots off, digits do nothing', () => {
  const { stage, flights } = hotspotStage('off')
  let prevented = false
  stage._onKey({ key: '2', target: null, preventDefault() { prevented = true } })
  assert.equal(stage.index, 0, 'no jump to a slide')
  assert.equal(flights.length, 0)
  assert.equal(prevented, false, 'the key is left to the page')
  // The presenter's switch turns them on for this window.
  stage._refreshHotspots = () => {}
  stage.hotspotsForced = true
  assert.equal(stage.hotspotMode, 'auto')
})

test('a step on the same slide leaves the hotspot and shows the whole slide', () => {
  const { stage, flights } = hotspotStage()
  stage.zoomToHotspot(1)
  stage.next('keyboard')
  assert.equal(stage.hotspot, null)
  assert.deepEqual(flights.at(-1), { zoom: null, reason: 'hotspot-reset' })
  assert.equal(stage.state.step, 0, 'and the step is shown too')
})

test('the overview fits every slide it can, and its keys move a cursor and go there', () => {
  const { stage, messages } = stageFixture()
  // Twelve slides in a 1600×900 window: all at once, in a grid of a few columns.
  const layout = stage.overviewLayout(12, 1600, 900)
  assert.ok(layout.cols >= 3 && layout.cols <= 5, `columns: ${layout.cols}`)
  assert.ok(layout.rows * layout.cols >= 12)
  assert.ok(layout.k * 1920 >= 160)
  // Two hundred slides: the slides stay readable, and the grid scrolls.
  const many = stage.overviewLayout(200, 1600, 900)
  assert.ok(many.k * 1920 >= 159, 'thumbnails keep a readable width')
  assert.ok(many.rows * (1080 + many.label) * many.k > 900)

  stage._fit = () => {}
  stage._ovLayout = { cols: 2 }
  stage._overview = true
  stage._ovCursor = 0
  const before = messages.length
  assert.equal(stage.overviewKey('ArrowRight'), true)
  assert.equal(stage._ovCursor, 1)
  assert.equal(stage.overviewKey('ArrowLeft'), true)
  assert.equal(stage._ovCursor, 0)
  assert.equal(messages.length, before, 'moving the cursor tells nobody')
  stage.overviewKey('End')
  assert.equal(stage.overviewKey('Enter'), true)
  assert.equal(stage.overview, false)
  assert.equal(stage.index, 1)
  assert.equal(messages.at(-1).deckStateChanged.index, 1, 'going to a slide is an ordinary change')
  assert.equal(stage.overviewKey('ArrowRight'), false, 'closed, the keys are the slides’ again')
})
