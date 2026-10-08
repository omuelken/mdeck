// Finds the component tag a phone should see: the one whose `room` attribute
// matches, with its content if it has any.
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Code is not an activity: fenced blocks and `inline code` are blanked out
// (keeping every other character where it was) before searching.
const blank = text => text.replace(/[^\n]/g, ' ')
export function maskCode(source = '') {
  return source.replace(/^(```+|~~~+)[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, blank).replace(/`[^`\n]+`/g, blank)
}

// Inside a tag: anything but its end, with quoted values whole, so a `>` in
// an attribute (question="Is $x > 0$?") does not end the tag.
const INSIDE = `(?:[^>"']|"[^"]*"|'[^']*')`

// Every activity in a source, in order: [{ tag, room }].
export function roomsIn(source = '') {
  return [...maskCode(source).matchAll(new RegExp(`<([a-z][a-z0-9-]*)\\b${INSIDE}*?\\broom\\s*=\\s*(["'])([^"']+)\\2`, 'gi'))].map(match => ({ tag: match[1].toLowerCase(), room: match[3] }))
}

// The rooms on one slide, from its body and its named regions (the body is
// also a region, so each room is listed once).
export function roomsOnSlide(slide) {
  if (!slide) return []
  const rooms = [slide.content ?? '', ...Object.values(slide.regions ?? {}).map(region => region.content ?? '')].flatMap(roomsIn).map(found => found.room)
  return [...new Set(rooms)]
}

// The heading of the slide that holds `room` (what the audience saw), else
// its `title:` setting, or ''.
export function slideTitleFor(deck, room) {
  const slide = deck.slides.find(slide => findRoomTag(slide.content ?? '', room) || Object.values(slide.regions ?? {}).some(region => findRoomTag(region.content ?? '', room)))
  return slide?.content?.match(/^\s*#{1,3}\s+(.+?)\s*#*\s*$/m)?.[1]?.replace(/[*_`]/g, '') ?? slide?.meta.title ?? ''
}

export function findRoomTag(source, room) {
  const open = new RegExp(`<([a-z][a-z0-9-]*)\\b${INSIDE}*?\\broom\\s*=\\s*(["'])${escape(room)}\\2${INSIDE}*>`, 'i').exec(maskCode(source))
  if (!open) return null
  if (open[0].endsWith('/>')) return open[0]
  const close = source.indexOf(`</${open[1]}>`, open.index + open[0].length)
  return close < 0 ? open[0] : source.slice(open.index, close + open[1].length + 3)
}
