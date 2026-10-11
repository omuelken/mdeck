import test from 'node:test'
import assert from 'node:assert/strict'
import { fitRect, flight, durationFor, cameraTransform } from '../src/runtime/zoom/camera.js'

// The smooth zoom of the zoom branch's camera, used by hotspots.

test('camera: fit, transform, and a flight that lands exactly', () => {
  const cam = fitRect({ x: 0, y: 0, w: 1920, h: 1080 }, 16 / 9)
  assert.deepEqual(cam, { x: 960, y: 540, w: 1920 })
  assert.equal(fitRect({ x: 0, y: 0, w: 100, h: 100 }, 2).w, 200)
  const { k, tx, ty } = cameraTransform(cam, 960, 540)
  assert.equal(k, 0.5)
  assert.equal(tx, 0)
  assert.equal(ty, 0)
  const to = { x: 10000, y: 3000, w: 1920 }
  const path = flight(cam, to)
  assert.deepEqual(path.at(0), cam)
  assert.deepEqual(path.at(1), to)
  const near = path.at(0.999)
  assert.ok(Math.abs(near.x - to.x) < 20 && Math.abs(near.w - to.w) < 20)
  // A far flight rises: the middle shows more than either end.
  assert.ok(path.at(0.5).w > 2 * to.w)
  // Zooming straight out has a length too.
  assert.ok(flight(cam, { ...cam, w: cam.w * 8 }).length > 1)
  assert.ok(durationFor(path.length) > durationFor(flight(cam, { x: 3100, y: 540, w: 1920 }).length))
  assert.ok(durationFor(100) <= 1600 && durationFor(0) >= 450)
})
