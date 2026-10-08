import test from 'node:test'
import assert from 'node:assert/strict'
import { Marked } from 'marked'
import { parseFragment } from 'parse5'
import { expandPollLists, listChoices, pollChoices } from '../src/core/pollList.js'
import { closeTags } from '../src/core/tags.js'
import { findRoomTag, roomsIn } from '../src/live/roomTag.js'
import { hasActivity } from '../src/core/editDeck.js'

// The poll as the slide gets it: marked with the hook the runtime uses,
// read by a browser's parser.
const slideMarked = new Marked({ hooks: { preprocess: expandPollLists } })
function pollsOn(markdown) {
  const found = []
  const walk = node => {
    if (node.tagName === 'poll') found.push(Object.fromEntries(node.attrs.map(attr => [attr.name, attr.value])))
    for (const child of node.childNodes ?? []) walk(child)
  }
  walk(parseFragment(slideMarked.parse(markdown)))
  return found
}
const choices = attrs => pollChoices(attrs['data-choices'])

test('a list inside a poll gives its options, [x] the right ones', () => {
  const source = '# Q\n\n<poll room="deriv" question="What is $\\frac{d}{dx} x^2$?">\n\n- [x] $2x$\n- [ ] $x^2$\n- [ ] `a|b` and $|x|$\n- [ ] a long\n  option\n\n</poll>\n\nAfter the poll.'
  const [poll] = pollsOn(source)
  assert.equal(poll.room, 'deriv')
  assert.equal(poll.question, 'What is $\\frac{d}{dx} x^2$?')
  assert.deepEqual(choices(poll), [
    { text: '$2x$', right: true },
    { text: '$x^2$', right: false },
    { text: '`a|b` and $|x|$', right: false },
    { text: 'a long option', right: false },
  ])
  assert.match(slideMarked.parse(source), /<p>After the poll\.<\/p>/)
})

test('the list needs no blank lines, and plain items have no right answer', () => {
  const [poll] = pollsOn('<poll room="a">\n- Mensa\n- Thai | Pizza\n* ![a sketch](pic.png)\n</poll>')
  assert.deepEqual(choices(poll).map(choice => choice.text), ['Mensa', 'Thai | Pizza', '![a sketch](pic.png)'])
  const [numbered] = pollsOn('<poll room="b">\n1. one\n2. two\n</poll>')
  assert.deepEqual(choices(numbered), [{ text: 'one', right: false }, { text: 'two', right: false }])
})

test('quotes and ampersands in options survive the attribute', () => {
  const [poll] = pollsOn('<poll room="a">\n\n- say "hi" & go\n- it\'s &amp; fine\n\n</poll>')
  assert.deepEqual(choices(poll).map(choice => choice.text), ['say "hi" & go', "it's &amp; fine"])
})

test('a poll without a list stays as written', () => {
  for (const source of [
    '<poll room="a" options="x|y" />',
    '<poll room="a" options="x|y"></poll>',
    '<poll room="a">\n\nSome text\n\n- x\n\n</poll>',
    '```markdown\n<poll room="a">\n- x\n</poll>\n```',
  ]) assert.equal(expandPollLists(source), source)
  assert.equal(listChoices('- \n- [ ] '), null)
})

test('the phones read the same options as the slide', () => {
  const source = '# Lunch\n\nVote:\n\n<poll room="lunch" multiple>\n\n- [x] **Thai** | spicy\n- [ ] $|x|$\n\n</poll>\n'
  assert.deepEqual(roomsIn(source), [{ tag: 'poll', room: 'lunch' }])
  assert.equal(hasActivity({ content: source }), true)
  // main.jsx expands the tag findRoomTag gives before reading its attributes.
  const [phone] = (function read(node, out = []) {
    if (node.tagName === 'poll') out.push(Object.fromEntries(node.attrs.map(attr => [attr.name, attr.value])))
    for (const child of node.childNodes ?? []) read(child, out)
    return out
  })(parseFragment(expandPollLists(findRoomTag(source, 'lunch'))))
  assert.deepEqual(phone, pollsOn(source)[0])
  assert.deepEqual(choices(phone), [{ text: '**Thai** | spicy', right: true }, { text: '$|x|$', right: false }])
})

test('a self-closed component keeps what follows it out of it', () => {
  const html = '<poll room="a" options="x|y" /><p>After</p><scale room="b"/><p>More</p><img src="x.png" />'
  const closed = closeTags(html, new Set(['poll', 'scale']))
  assert.equal(closed, '<poll room="a" options="x|y"></poll><p>After</p><scale room="b"></scale><p>More</p><img src="x.png" />')
  const top = parseFragment(closed).childNodes.map(node => node.tagName)
  assert.deepEqual(top, ['poll', 'p', 'scale', 'p', 'img'])
})
