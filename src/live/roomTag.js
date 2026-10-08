// Finds the component tag a phone should see: the one whose `room` attribute
// matches, with its content if it has any.
import { tagsIn } from '../core/tags.js'

// Every activity in a source, in order: [{ tag, room }]. Tags in code are
// not activities (src/core/tags.js).
export function roomsIn(source = '') {
  return tagsIn(source).filter(tag => !tag.closing && tag.attrs.room).map(tag => ({ tag: tag.name, room: tag.attrs.room }))
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
  const text = String(source ?? '').replace(/\r\n?/g, '\n')
  const tags = tagsIn(text)
  const at = tags.findIndex(tag => !tag.closing && tag.attrs.room === room)
  if (at < 0) return null
  const open = tags[at]
  if (open.selfClosing || open.start == null) return open.raw
  // Its closing tag, past any of the same name inside it.
  let depth = 0
  for (const tag of tags.slice(at + 1)) {
    if (tag.name !== open.name || tag.selfClosing) continue
    if (!tag.closing) depth++
    else if (depth) depth--
    else return tag.end == null ? open.raw : text.slice(open.start, tag.end)
  }
  return open.raw
}
