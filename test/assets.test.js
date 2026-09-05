import test from 'node:test'
import assert from 'node:assert/strict'
import { collectLocalAssetRefs } from '../src/slidesPlugin.js'

test('asset checking understands reference images and ignores code examples', () => {
  assert.deepEqual(collectLocalAssetRefs('# Figure\n![diagram][fig]\n\n[fig]: ./img/diagram.png\n\n```markdown\n![fake](missing.png)\n```'), ['./img/diagram.png'])
})

test('assets in explicit metadata, slots and speaker notes are collected', () => {
  const source = ':::meta\nlayout: split\nprops:\n  image: ./hero.png\n:::\n:::slot left\n<videoplayer src="./demo.mp4" />\n:::\n:::notes\n![Note image](./note.png)\n:::'
  assert.deepEqual(collectLocalAssetRefs(source).sort(), ['./demo.mp4', './hero.png', './note.png'])
})
