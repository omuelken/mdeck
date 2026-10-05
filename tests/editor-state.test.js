import test from 'node:test'
import assert from 'node:assert/strict'
import { reduce, initialState, selectedSlide } from '../src/editor/state.js'
import { createSaveQueue } from '../src/editor/saveQueue.js'
import { fieldKind, parseFieldValue, formatFieldValue } from '../src/editor/schema.js'
import { slideTitle, regionsFor, propSource, slideDiagnostics } from '../src/editor/model.js'
import { setRegion, insertSlide, removeSlide } from '../src/core/editDeck.js'
import { loadRegistry, serializeRegistry } from '../src/extensions/discover.js'

const registry = serializeRegistry(loadRegistry('examples/custom-layouts/slides.md'))
const source = '---\ndesign: neue\n---\n\n---\n:::meta\nlayout: split\nid: one\n:::\n# One\n\n---\n# Two\n'
const loaded = reduce(initialState, { type: 'load', path: '/x/slides.md', name: 'slides.md', source, hash: 'h1', registry })

test('loading derives the deck, manifests and diagnostics', () => {
  assert.equal(loaded.deck.slides.length, 2)
  assert.equal(loaded.manifests.layouts.split.title, 'Split content')
  assert.equal(loaded.manifests.themes.neue.tokens['--accent'], '#0d9488')
  assert.deepEqual(loaded.diagnostics, [])
  assert.equal(loaded.status, 'saved')
  assert.equal(selectedSlide(loaded).id, 'one')
})

test('edits go through helpers, coalesce typing and support undo and redo', () => {
  let state = reduce(loaded, { type: 'edit', apply: deck => setRegion(deck, 'one', 'body', '# On'), group: 'region:one:body', now: 1000 })
  state = reduce(state, { type: 'edit', apply: deck => setRegion(deck, 'one', 'body', '# One!'), group: 'region:one:body', now: 1200 })
  assert.equal(state.history.past.length, 1, 'typing in one field coalesces')
  assert.equal(state.status, 'unsaved')
  state = reduce(state, { type: 'edit', apply: deck => setRegion(deck, 'one', 'body', '# One?'), group: 'region:one:body', now: 5000 })
  assert.equal(state.history.past.length, 2, 'a pause starts a new history entry')
  state = reduce(state, { type: 'edit', apply: deck => insertSlide(deck, 1, '# Mid'), now: 6000 })
  assert.equal(state.selectedIndex, 1)
  assert.equal(state.deck.slides[1].content, '# Mid')
  state = reduce(state, { type: 'undo' })
  assert.equal(state.deck.slides.length, 2)
  assert.equal(state.deck.slides[0].content, '# One?')
  state = reduce(state, { type: 'undo' })
  assert.equal(state.deck.slides[0].content, '# One!')
  state = reduce(state, { type: 'redo' })
  assert.equal(state.deck.slides[0].content, '# One?')
  state = reduce(state, { type: 'undo' }); state = reduce(state, { type: 'undo' })
  assert.equal(state.source, source)
  assert.equal(state.status, 'saved', 'back at the saved text')
  assert.equal(reduce(state, { type: 'undo' }), state)
  assert.equal(reduce(loaded, { type: 'edit', apply: deck => deck.source }), loaded, 'no-op edits are ignored')
})

test('removing the selected slide keeps the selection in range', () => {
  const state = reduce(reduce(loaded, { type: 'select', index: 1 }), { type: 'edit', apply: deck => removeSlide(deck, 'slide-2') })
  assert.equal(state.deck.slides.length, 1)
  assert.equal(state.selectedIndex, 0)
})

test('save status, conflicts and external changes', () => {
  let state = reduce(loaded, { type: 'edit', apply: deck => setRegion(deck, 'one', 'body', '# Edited') })
  state = reduce(state, { type: 'saving' })
  assert.equal(state.status, 'saving')
  state = reduce(state, { type: 'saved', hash: 'h2', source: state.source })
  assert.equal(state.status, 'saved')
  assert.equal(state.hash, 'h2')
  const external = reduce(state, { type: 'externalChange', source: source, hash: 'h3' })
  assert.equal(external.source, source)
  assert.equal(external.hash, 'h3')
  assert.equal(external.history.past.length, 2, 'external changes are undoable')
  const dirty = reduce(state, { type: 'edit', apply: deck => setRegion(deck, 'one', 'body', '# Local') })
  const conflicted = reduce(dirty, { type: 'externalChange', source: source, hash: 'h3' })
  assert.equal(conflicted.status, 'conflict')
  const kept = reduce(conflicted, { type: 'edit', apply: deck => setRegion(deck, 'one', 'body', '# Still local') })
  assert.equal(kept.status, 'conflict', 'editing during a conflict keeps the banner')
  const overwrite = reduce(conflicted, { type: 'resolveConflict', choice: 'overwrite' })
  assert.equal(overwrite.status, 'unsaved')
  assert.equal(overwrite.hash, 'h3')
  assert.equal(overwrite.deck.slides[0].content, '# Local')
  const reload = reduce(conflicted, { type: 'resolveConflict', choice: 'reload' })
  assert.equal(reload.status, 'saved')
  assert.equal(reload.source, source)
  assert.equal(reduce(reload, { type: 'undo' }).deck.slides[0].content, '# Local', 'reload can be undone')
  assert.equal(reduce(state, { type: 'saveError', message: 'nope' }).status, 'error')
})

test('the save queue debounces, chains hashes and pauses on conflict', async () => {
  const saves = [], events = []
  let timers = []
  const fakeSetTimeout = (fn, ms) => { const id = timers.length + 1; timers.push({ id, fn, ms }); return id }
  const fakeClearTimeout = id => { timers = timers.filter(t => t.id !== id) }
  const runTimers = async () => { const due = timers; timers = []; for (const t of due) await t.fn() }
  let fail = null
  const queue = createSaveQueue({
    delay: 400, setTimeout: fakeSetTimeout, clearTimeout: fakeClearTimeout,
    save: async (source, base) => { saves.push({ source, base }); if (fail) { const error = fail; fail = null; throw error } return { hash: `h(${source})` } },
    onSaving: () => events.push('saving'), onSaved: info => events.push(`saved:${info.hash}`), onConflict: () => events.push('conflict'), onError: e => events.push(`error:${e.message}`),
  })
  queue.setBase('h0')
  queue.push('a'); queue.push('ab'); queue.push('abc')
  assert.equal(timers.length, 1, 'pushes are coalesced into one timer')
  await runTimers(); await new Promise(r => setImmediate(r))
  assert.deepEqual(saves, [{ source: 'abc', base: 'h0' }])
  assert.equal(queue.base(), 'h(abc)')
  queue.push('abcd'); await runTimers(); await new Promise(r => setImmediate(r))
  assert.deepEqual(saves.at(-1), { source: 'abcd', base: 'h(abc)' }, 'the next save uses the returned hash')
  fail = Object.assign(new Error('conflict'), { conflict: true, source: 'disk', hash: 'hd' })
  queue.push('abcde'); await runTimers(); await new Promise(r => setImmediate(r))
  assert.deepEqual(events.slice(-2), ['saving', 'conflict'])
  queue.push('abcdef')
  assert.equal(timers.length, 0, 'paused queues do not schedule saves')
  await queue.overwrite('hd'); await new Promise(r => setImmediate(r))
  assert.deepEqual(saves.at(-1), { source: 'abcdef', base: 'hd' })
  assert.equal(queue.pending(), false)
  fail = new Error('offline')
  queue.push('x'); await runTimers(); await new Promise(r => setImmediate(r))
  assert.equal(events.at(-1), 'error:offline')
  assert.equal(queue.pending(), true, 'failed saves are retried later')
})

test('schema and model helpers', () => {
  assert.equal(fieldKind({ type: 'string', enum: ['a'] }), 'select')
  assert.equal(fieldKind({ type: 'boolean' }), 'checkbox')
  assert.equal(fieldKind({ type: 'integer' }), 'number')
  assert.equal(fieldKind({ type: 'array' }), 'yaml')
  assert.deepEqual(parseFieldValue('number', '2.5', { type: 'integer' }), { error: 'Enter a whole number' })
  assert.deepEqual(parseFieldValue('number', '', {}), { value: undefined })
  assert.deepEqual(parseFieldValue('yaml', '[1, 2]'), { value: [1, 2] })
  assert.ok(parseFieldValue('yaml', '[1, 2').error)
  assert.equal(formatFieldValue('yaml', [1, 2]), '[1, 2]')
  assert.equal(formatFieldValue('text', undefined), '')
  const slide = loaded.deck.slides[0]
  assert.equal(slideTitle(slide, 0, loaded.manifests.layouts.split), 'One')
  assert.equal(slideTitle({ content: '', meta: {} }, 3, null), 'Slide 4')
  const regions = regionsFor(slide, loaded.manifests.layouts.split)
  assert.deepEqual(regions.map(r => [r.name, r.present]), [['body', true], ['left', false], ['right', false]])
  assert.equal(propSource({ image: 'x.png' }, 'image'), 'legacy')
  assert.equal(propSource({ props: { image: 'x.png' } }, 'image'), 'props')
  assert.equal(propSource({}, 'image'), null)
  const broken = reduce(loaded, { type: 'edit', apply: () => source.replace('# Two', ':::meta\nlayout: split\nprops:\n  ratio: [0]\n:::\n# Two') })
  assert.ok(slideDiagnostics(broken.diagnostics, broken.deck.slides[1]).length)
  assert.equal(slideDiagnostics(broken.diagnostics, broken.deck.slides[0]).length, 0)
})
