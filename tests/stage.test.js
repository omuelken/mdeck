import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'

// Exercise the real stage state machine without a browser layout engine.
function stageFixture() {
  let Stage
  const messages = []
  const events = []
  const window = { postMessage: message => messages.push(message) }
  window.parent = window
  vm.runInNewContext(readFileSync(new URL('../src/runtime/deck-stage.js', import.meta.url), 'utf8'), {
    HTMLElement: class { attachShadow() { return {} } dispatchEvent(event) { events.push(event) } toggleAttribute(name, on) { this[name] = on } },
    customElements: { get() {}, define(name, value) { Stage = value } },
    location: { search: '', hash: '' }, history: { replaceState() {} },
    URLSearchParams, window, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail } },
  })
  const stage = new Stage()
  const step = () => ({ dataset: { step: '0' }, setAttribute() { this.visible = true }, removeAttribute() { this.visible = false } })
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
