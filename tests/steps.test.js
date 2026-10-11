import test from 'node:test'
import assert from 'node:assert/strict'
import { slideSteps } from '../src/runtime/steps.js'

// Just enough of the DOM: elements in document order, each with its step
// attribute and the drawing it is in.
const part = (name, step, drawing = null) => ({ name, getAttribute: () => step, closest: () => drawing })
const slideOf = parts => ({ querySelectorAll: () => parts })
const names = steps => steps.map(step => step.map(part => part.name))

test('steps follow the document, one element each', () => {
  // A list in :::steps numbers its items itself; outside a drawing the number is not read.
  const steps = slideSteps(slideOf([part('a', '0'), part('b', '1'), part('c', '0'), part('d', '')]))
  assert.deepEqual(names(steps), [['a'], ['b'], ['c'], ['d']])
  assert.deepEqual(slideSteps(null), [])
})

test("a drawing's numbered parts show in their order, the same number together", () => {
  const svg = {}
  const steps = slideSteps(slideOf([
    part('before', '0'),
    part('arrow', '2', svg), part('box1', '1', svg), part('box2', '1', svg), part('label', '3', svg),
    part('after', '1'),
  ]))
  assert.deepEqual(names(steps), [['before'], ['box1', 'box2'], ['arrow'], ['label'], ['after']])
})

test('bare steps in a drawing keep their place; two drawings keep their own numbers', () => {
  const one = {}
  const two = {}
  const steps = slideSteps(slideOf([
    part('bare', '', one), part('one-b', '2', one), part('one-a', '1', one),
    part('two-a', '1', two), part('loose', 'x', two), part('one-c', '1.5', one),
  ]))
  assert.deepEqual(names(steps), [['bare'], ['one-a'], ['one-c'], ['one-b'], ['two-a'], ['loose']])
})
