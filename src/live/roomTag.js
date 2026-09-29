// Finds the component tag a phone should see: the one whose `room` attribute
// matches, with its content if it has any.
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// The heading of the slide that holds `room`, or ''.
export function slideTitleFor(deck, room) {
  const slide = deck.slides.find(slide => findRoomTag(slide.content ?? '', room) || Object.values(slide.regions ?? {}).some(region => findRoomTag(region.content ?? '', room)))
  return slide?.meta.title ?? slide?.content?.match(/^\s*#{1,3}\s+(.+?)\s*#*\s*$/m)?.[1]?.replace(/[*_`]/g, '') ?? ''
}

export function findRoomTag(source, room) {
  const open = new RegExp(`<([a-z][a-z0-9-]*)\\b[^>]*?\\broom\\s*=\\s*(["'])${escape(room)}\\2[^>]*>`, 'i').exec(source)
  if (!open) return null
  if (open[0].endsWith('/>')) return open[0]
  const close = source.indexOf(`</${open[1]}>`, open.index + open[0].length)
  return close < 0 ? open[0] : source.slice(open.index, close + open[1].length + 3)
}
