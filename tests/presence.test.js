import test from 'node:test'
import assert from 'node:assert/strict'
import { deviceKind, devicesText, phonesText } from '../src/live/presence.js'

test('a window names its device roughly, and an iPad that says it is a Mac is still an iPad', () => {
  assert.equal(deviceKind({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', maxTouchPoints: 5 }), 'ipad')
  assert.equal(deviceKind({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', maxTouchPoints: 0 }), 'computer')
  assert.equal(deviceKind({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }), 'phone')
  assert.equal(deviceKind({ userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-X710)' }), 'tablet')
  assert.equal(deviceKind({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/140' }), 'computer')
})

test('connected views are described in words', () => {
  assert.equal(devicesText([{ device: 'ipad' }]), 'an iPad')
  assert.equal(devicesText([{ device: 'ipad' }, { device: 'computer' }, { device: 'computer' }]), 'an iPad and 2 computers')
  assert.equal(phonesText(1), '1 phone')
  assert.equal(phonesText(12), '12 phones')
})
