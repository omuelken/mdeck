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
  const deck = new URL('../examples/showcase/slides.en.md', import.meta.url).pathname
  const example = '````markdown\n:::meta\nimage: ./img/image.jpg\n:::\n![Map](./img/image.jpg)\n````'
  const source = `:::meta\nlayout: image-text\nimage: ./img/image.jpg\n:::\n# Pic\n\n${example}\n\n![Map](./img/image.jpg)\n`
  const out = maybeInlineAssets(source, deck, { inlineImages: true })
  assert.equal(out.match(/data:image\/jpeg/g).length, 2)
  assert.ok(out.includes(example))
})

test('SVG pictures that use theme colours are drawn inline, not embedded as files', () => {
  const deck = new URL('../examples/showcase/slides.en.md', import.meta.url).pathname
  const svgs = themedSvgs(deck)
  assert.deepEqual(Object.keys(svgs), ['./img/mdeck.svg'])
  assert.match(svgs['./img/mdeck.svg'].markup, /^<svg[^>]*>[\s\S]*var\(--accent/)
  const out = maybeInlineAssets(':::meta\nlayout: title\nimage: ./img/mdeck.svg\n:::\n# T\n\n![Map](./img/image.jpg)\n', deck, { inlineImages: true })
  assert.match(out, /image: \.\/img\/mdeck\.svg/)
  assert.match(out, /data:image\/jpeg/)
})

test('posters, srcset candidates, url(…) in styles and links to files count as local files', () => {
  const source = '# T\n\n<video src="./a.mp4" poster="./p.png"></video>\n\n<img src="./s.png" srcset="./s.png 1x, ./s2.png 2x" style="background: url(./bg.png)">\n\n<div style="background-image: url(\'./bg2.jpg\')">x</div>\n\n<a href="./handout.pdf">h</a> <a href="https://x.org/a.pdf">no</a> <a href="mailto:a@b.c">m</a>\n\nRead [the paper](./paper.pdf), [the site](https://x.org), [the reader](?view=reader) or [below](#x).\n'
  assert.deepEqual(collectLocalAssetRefs(source).sort(), ['./a.mp4', './bg.png', './bg2.jpg', './handout.pdf', './p.png', './paper.pdf', './s.png', './s2.png'])
  const deck = new URL('../examples/showcase/slides.en.md', import.meta.url).pathname
  const out = maybeInlineAssets('<img src="./img/image.jpg" srcset="./img/image.jpg 2x" style="background: url(./img/image.jpg)"> <a href="./img/image.jpg">x</a>\n', deck, { inlineImages: true })
  assert.equal(out.match(/data:image\/jpeg/g).length, 3)
  assert.ok(out.includes('<a href="./img/image.jpg">'), 'a link to a file stays a link')
})
