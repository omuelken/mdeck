import test from 'node:test'
import assert from 'node:assert/strict'
import { collectLocalAssetRefs, maybeInlineAssets, themedSvgs } from '../src/build/slidesPlugin.js'

test('asset checking understands reference images and ignores code examples', () => {
  assert.deepEqual(collectLocalAssetRefs('# Figure\n![diagram][fig]\n\n[fig]: ./img/diagram.png\n\n```markdown\n![fake](missing.png)\n```'), ['./img/diagram.png'])
})

test('assets in explicit metadata, slots and speaker notes are collected', () => {
  const source = ':::meta\nlayout: split\nprops:\n  image: ./hero.png\n:::\n:::slot left\n<videoplayer src="./demo.mp4" />\n:::\n:::notes\n![Note image](./note.png)\n:::'
  assert.deepEqual(collectLocalAssetRefs(source).sort(), ['./demo.mp4', './hero.png', './note.png'])
})

test("pictures in a tag's attributes, such as a poll's options, are collected", () => {
  const source = '# Which graph?\n\n<poll room="graph" options="![](./a.svg)|![B](b.png)" answer="![](./a.svg)" buttons="letters" />\n'
  assert.deepEqual(collectLocalAssetRefs(source).sort(), ['./a.svg', 'b.png'])
})

test('embedding pictures leaves code examples as text', () => {
  const deck = new URL('../examples/showcase/slides.md', import.meta.url).pathname
  const example = '````markdown\n:::meta\nimage: ./img/image.jpg\n:::\n![Map](./img/image.jpg)\n````'
  const source = `:::meta\nlayout: image-text\nimage: ./img/image.jpg\n:::\n# Pic\n\n${example}\n\n![Map](./img/image.jpg)\n`
  const out = maybeInlineAssets(source, deck, { inlineImages: true })
  assert.equal(out.match(/data:image\/jpeg/g).length, 2)
  assert.ok(out.includes(example))
})

test('SVG pictures that use theme colours are drawn inline, not embedded as files', () => {
  const deck = new URL('../examples/showcase/slides.md', import.meta.url).pathname
  const svgs = themedSvgs(deck)
  assert.deepEqual(Object.keys(svgs), ['./img/mdeck.svg'])
  assert.match(svgs['./img/mdeck.svg'].markup, /^<svg[^>]*>[\s\S]*var\(--accent/)
  const out = maybeInlineAssets(':::meta\nlayout: title\nimage: ./img/mdeck.svg\n:::\n# T\n\n![Map](./img/image.jpg)\n', deck, { inlineImages: true })
  assert.match(out, /image: \.\/img\/mdeck\.svg/)
  assert.match(out, /data:image\/jpeg/)
})
