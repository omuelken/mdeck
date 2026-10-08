import test from 'node:test'
import assert from 'node:assert/strict'
import { Marked } from 'marked'
import markedKatex from 'marked-katex-extension'
import { parseFragment } from 'parse5'
import { scanTags, openTagsIn, replaceTagsIn, withAttribute } from '../src/core/tags.js'
import { roomsIn, findRoomTag } from '../src/live/roomTag.js'
import { hasActivity } from '../src/core/editDeck.js'
import { choicesOf } from '../src/components/inlineText.js'

// What the slide sees: marked's HTML, read by a browser's parser (parse5
// follows the HTML standard). The components are the elements in it.
const slideMarked = new Marked().use(markedKatex({ throwOnError: false, output: 'html' }))
function elementsOf(html) {
  const found = []
  const walk = node => {
    if (node.tagName) found.push({ name: node.tagName, attrs: Object.fromEntries(node.attrs.map(attr => [attr.name, attr.value])) })
    for (const child of node.childNodes ?? []) walk(child)
  }
  walk(parseFragment(html))
  return found
}
const onSlide = markdown => elementsOf(slideMarked.parse(markdown))

// A small seeded generator, so a failure can be reproduced.
function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const VALUES = ['Is $x > 0$?', '$x<0$', 'a > b', 'a<b', "it's", 'say "hi"', '$|x|$', 'A|B|C', 'Tom &amp; Jerry', 'one\ntwo', '/>', 'x = 1', '`code`', '<b>bold</b>', 'Grüße', '**strong**', '![p](pic.png)|q', '']
const TAGS = ['poll', 'scale', 'numeric', 'quiz', 'qrcode']

function attribute(pick, name, value) {
  const quotes = [!value.includes('"') && '"', !value.includes("'") && "'", /^[\w.-]+$/.test(value) && ''].filter(quote => quote !== false)
  const quote = pick(quotes)
  return `${name}${pick(['=', ' = ', '='])}${quote}${value}${quote}`
}

function tag(pick, room) {
  const name = pick(TAGS)
  const attrs = [attribute(pick, 'room', room)]
  for (const extra of ['question', 'options', 'label']) if (pick([true, false])) attrs.push(attribute(pick, extra, pick(VALUES)))
  attrs.sort(() => pick([-1, 1]))
  const space = () => pick([' ', ' ', '\n  '])
  const body = pick(['', 'What is 2+2?'])
  return body ? `<${name}${attrs.map(a => space() + a).join('')}>${body}</${name}>` : `<${name}${attrs.map(a => space() + a).join('')}${space()}/>`
}

// Where a tag can stand in a slide; code shows a tag without making one.
const PLACES = [
  t => t,
  t => `Vote now: ${t}`,
  t => `- first\n- ${t}`,
  t => `> ${t}`,
  t => `::: note\n${t}\n:::`,
  t => `| a | b |\n|---|---|\n| ${t.replace(/\n/g, ' ').replace(/\|/g, '\\|')} | x |`,
  t => `\`\`\`markdown\n${t}\n\`\`\``,
  t => `Inline: \`${t.replace(/\n/g, ' ').replace(/`/g, '')}\``,
  t => `    ${t.replace(/\n/g, '\n    ')}`,
]

function decks(count, seed) {
  const next = random(seed)
  const pick = list => list[Math.floor(next() * list.length)]
  return Array.from({ length: count }, (_, i) => {
    const parts = ['# Slide']
    for (let j = 0; j < 1 + Math.floor(next() * 3); j++) parts.push(pick(PLACES)(tag(pick, `r${i}-${j}`)))
    return parts.join(pick(['\n\n', '\n\n', '\n']))
  })
}

test('the tag reader reads tags as a browser does', () => {
  const html = [
    '<poll room="a" question="Is $x > 0$?" options=\'A|B\' />',
    '<scale room=b low="a<b" high=\'say "hi"\'/>',
    '<quiz ROOM="c" room="ignored" data-x = "1&amp;2&#33;&#x21;&quot;">x</quiz>',
    '<!-- <poll room="hidden" /> -->',
    'a < b and <br/> then <img src=pic.png alt="a > b">',
    '<script>if (a<b) "<poll room=\'no\'>"</script><numeric room="d" answer=0.5 />',
  ].join('\n')
  const read = scanTags(html).filter(found => !found.closing).map(({ name, attrs }) => ({ name, attrs }))
  assert.deepEqual(read, elementsOf(html))
})

test('activities are found exactly where the slide has them', () => {
  let found = 0, hidden = 0
  for (const source of decks(400, 1)) {
    found += roomsIn(source).length
    hidden += (source.match(/room\s*=/g) ?? []).length - roomsIn(source).length
    const rendered = onSlide(source).filter(element => element.attrs.room)
    assert.deepEqual(roomsIn(source), rendered.map(element => ({ tag: element.name, room: element.attrs.room })), source)
    for (const element of rendered) {
      // The phones read the tag findRoomTag gives them, as the browser does.
      const tag = findRoomTag(source, element.attrs.room)
      assert.deepEqual(elementsOf(tag)[0], element, `${element.attrs.room} in\n${source}`)
    }
  }
  // The decks hold both: tags on the slide, and tags in code or cut short.
  assert.ok(found > 300 && hidden > 100, `${found} found, ${hidden} not`)
})

test('a slide is an activity exactly when the slide shows one', () => {
  const live = new Set(['poll', 'question', 'wordcloud', 'scale', 'numeric'])
  for (const source of decks(400, 2)) {
    const expected = onSlide(source).some(element => live.has(element.name) || (element.name === 'qrcode' && 'join' in element.attrs))
    assert.equal(hasActivity({ content: source }), expected, source)
  }
  assert.equal(hasActivity({ content: '<qrcode label="a > b" join />' }), true)
  assert.equal(hasActivity({ content: '<qrcode join={false} />' }), false)
  assert.equal(hasActivity({ content: '<qrcode follow />' }), false)
})

test('a blank line inside a tag breaks it on the slide and for the phones alike', () => {
  const source = '<poll room="a" question="Line one\n\nline two" options="a|b" />'
  assert.deepEqual(onSlide(source).filter(element => element.name === 'poll'), [])
  assert.deepEqual(roomsIn(source), [])
})

test('sources of pictures and media in tags are rewritten where the slide reads them', () => {
  const source = 'See <img alt="a > b" src="pic.png"> here.\n\n```html\n<img src="pic.png">\n```\n\n<videoplayer title=\'x<y\' src="clip.mp4" />'
  const out = replaceTagsIn(source, found => found.attrs.src ? withAttribute(found, 'src', `data:${found.attrs.src}`) : undefined)
  assert.equal(out, 'See <img alt="a > b" src="data:pic.png"> here.\n\n```html\n<img src="pic.png">\n```\n\n<videoplayer title=\'x<y\' src="data:clip.mp4" />')
  assert.deepEqual(openTagsIn(source).map(found => found.attrs.src), ['pic.png', 'clip.mp4'])
})

test('options split only at bars outside Markdown that holds them', () => {
  assert.deepEqual(choicesOf('`a|b`|c'), ['`a|b`', 'c'])
  assert.deepEqual(choicesOf('[x|y](https://example.org)|z'), ['[x|y](https://example.org)', 'z'])
  assert.deepEqual(choicesOf('![p|q](pic.png)|r'), ['![p|q](pic.png)', 'r'])
  assert.deepEqual(choicesOf('<abbr title="a|b">ab</abbr>|c'), ['<abbr title="a|b">ab</abbr>', 'c'])
  // Emphasis does not hold a bar: these are products, not one emphasis.
  assert.deepEqual(choicesOf('2*3|4*5'), ['2*3', '4*5'])
  assert.deepEqual(choicesOf('**yes**|*no*'), ['**yes**', '*no*'])
  assert.deepEqual(choicesOf('# one|- two|> three'), ['# one', '- two', '> three'])
})

test('options joined with bars split back into the same options', () => {
  const pieces = ['plain', 'two words', '`a|b`', '$|x|$', '$x^2$', '$$\\{x \\mid x > 0\\}$$', '[x|y](u)', '![p|q](i.png)', '**bold**', '*it*', '2*3', '\\$5', 'a \\| b', '&amp;', 'ü']
  // A price next to a formula is written \$5: "$5|…|$x$" is a formula from
  // the first dollar to the last, for KaTeX as for the bars.
  const next = random(3)
  for (let i = 0; i < 500; i++) {
    const options = Array.from({ length: 2 + Math.floor(next() * 4) }, () => Array.from({ length: 1 + Math.floor(next() * 2) }, () => pieces[Math.floor(next() * pieces.length)]).join(' '))
    // `\|` is a bar in the text: it comes back as one.
    assert.deepEqual(choicesOf(options.join('|')), options.map(option => option.replace(/\\\|/g, '|')), options.join('|'))
  }
})
