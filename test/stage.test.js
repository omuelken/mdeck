import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'

// Exercise the real stage state machine without a browser layout engine.
function stageFixture() {
  let Stage
  const messages = []
  const window = { postMessage: message => messages.push(message) }
  window.parent = window
  vm.runInNewContext(readFileSync(new URL('../src/deck-stage.js', import.meta.url), 'utf8'), {
    HTMLElement: class { attachShadow() { return {} } dispatchEvent() {} },
    customElements: { get() {}, define(name, value) { Stage = value } },
    location: { search: '', hash: '' }, history: { replaceState() {} },
    URLSearchParams, window, CustomEvent: class {},
  })
  const stage = new Stage()
  const step = () => ({ dataset: { step: '0' }, setAttribute() { this.visible = true }, removeAttribute() { this.visible = false } })
  stage._slides = ['first', 'second'].map(id => {
    const steps = [step(), step()]
    return { dataset: { slideId: id }, steps, querySelectorAll: () => steps, setAttribute() {}, removeAttribute() {} }
  })
  return { stage, messages }
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
