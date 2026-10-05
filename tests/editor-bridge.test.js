import test from 'node:test'
import assert from 'node:assert/strict'
import { createEditorBridge } from '../src/runtime/editorBridge.js'
import { parseSlides } from '../src/core/parseSlides.js'
import { validateDeck } from '../src/core/validateDeck.js'
import { templateManifests } from '../src/extensions/discover.js'

const layouts = templateManifests('examples/showcase/slides.md')

function harness() {
  const calls = { themes: [], mounts: [], posts: [], overrides: [] }
  const bridge = createEditorBridge({
    parse: parseSlides,
    setExtensionOverrides: value => calls.overrides.push(value),
    validate: deck => validateDeck(deck, { layouts }),
    loadTheme: async config => { await new Promise(r => setTimeout(r, 5)); if (config.theme === 'nope') throw new Error('Unknown theme: "nope"'); calls.themes.push(config.theme ?? 'default') },
    mount: ({ deck, deckConfig, selection }) => { if (deck.slides[0]?.content === '# boom') throw new Error('layout exploded'); calls.mounts.push({ count: deck.slides.length, theme: deckConfig.theme, selection }) },
    post: message => calls.posts.push(message),
  })
  return { bridge, calls }
}

test('the theme is loaded once per distinct deck config', async () => {
  const { bridge, calls } = harness()
  await bridge.render('---\ndesign: duet\n---\n# A')
  await bridge.render('---\ndesign: duet\n---\n# A changed')
  assert.deepEqual(calls.themes, ['duet'])
  await bridge.render('---\ndesign: terminal\n---\n# A changed')
  assert.deepEqual(calls.themes, ['duet', 'terminal'])
  assert.equal(calls.mounts.length, 3)
  assert.equal(calls.posts.at(-1).deckRendered.slideCount, 1)
  assert.deepEqual(calls.posts.at(-1).deckRendered.diagnostics, [])
})

test('an unknown theme falls back and is reported instead of thrown', async () => {
  const { bridge, calls } = harness()
  await bridge.render('---\ndesign: nope\n---\n# A')
  assert.deepEqual(calls.themes, ['neue'])
  assert.equal(calls.mounts[0].theme, 'neue')
  const codes = calls.posts[0].deckRendered.diagnostics.map(d => d.code)
  assert.ok(codes.includes('theme-load'))
  assert.equal(bridge.current().deckConfig.theme, 'neue')
})

test('broken decks and throwing layouts still render what they can', async () => {
  const { bridge, calls } = harness()
  await bridge.render('# One\n\n:::slot left\nunclosed\n---\n# Two')
  assert.ok(calls.mounts[0].count >= 1)
  assert.ok(calls.posts[0].deckRendered.diagnostics.some(d => d.code === 'unclosed-directive'))
  await bridge.render('# boom')
  assert.equal(calls.posts[1].deckRendered.error, 'layout exploded')
})

test('overlapping renders keep only the newest and messages are dispatched', async () => {
  const { bridge, calls } = harness()
  const first = bridge.render('---\ndesign: duet\n---\n# 1')
  bridge.render('---\ndesign: duet\n---\n# 2')
  assert.equal(bridge.handleMessage({ deckSource: { source: '---\ndesign: duet\n---\n# 3', selection: { index: 0, slideId: 'slide-1' } } }), true)
  assert.equal(bridge.handleMessage({ deckControl: { command: 'next' } }), false)
  await first
  await new Promise(r => setTimeout(r, 20))
  assert.equal(calls.mounts.length, 2)
  assert.deepEqual(calls.mounts[1].selection, { index: 0, slideId: 'slide-1' })
  assert.equal(bridge.current().deck.slides[0].content, '# 3')
})

test('preview config and extension overrides reload the theme when they change', async () => {
  const { bridge, calls } = harness()
  await bridge.render('---\ndesign: duet\n---\n# A', { config: { palette: 'sage' } })
  assert.equal(bridge.current().deckConfig.palette, 'sage')
  assert.deepEqual(calls.overrides, [{}])
  await bridge.render('---\ndesign: duet\n---\n# A', { config: { palette: 'sage' }, overrides: { palettes: { sage: { tokens: { '--bg': '#000' } } } } })
  assert.equal(calls.themes.length, 2, 'changed overrides reload the theme')
  assert.deepEqual(calls.overrides.at(-1), { palettes: { sage: { tokens: { '--bg': '#000' } } } })
  await bridge.render('---\ndesign: duet\n---\n# B', { config: { palette: 'sage' }, overrides: { palettes: { sage: { tokens: { '--bg': '#000' } } } } })
  assert.equal(calls.themes.length, 2, 'unchanged overrides do not')
  bridge.handleMessage({ deckSource: { source: '---\ndesign: duet\n---\n# C', config: { theme: 'terminal' } } })
  await new Promise(r => setTimeout(r, 20))
  assert.equal(calls.themes.at(-1), 'terminal')
})
