// The presenter's screen tells phones on the deck's answer link which
// activity is on the current slide. Decks without activities never call the
// server.
import { announce } from '../live/client.js'
import { registry } from './registry'
import { roomsIn, roomsOnSlide, findRoomTag, slideTitleFor } from '../live/roomTag.js'
import { expandPollLists } from '../core/pollList.js'
import { slidesContent } from './deckSource.js'

// Asked several times on every slide change (presenter view, the phones'
// announcement, the views connected), so the answer is kept until the text
// changes: finding the tags reads the whole deck, which on an iPad made each
// slide change noticeably slower.
// A deck with reactions (`reactions:`) wants the phones too, between activities.
let activitiesOf = null, activitiesFound = false, reactionsWanted = false
export const hasActivities = () => {
  if (activitiesOf !== slidesContent) { activitiesOf = slidesContent; activitiesFound = roomsIn(slidesContent).length > 0 }
  return activitiesFound || reactionsWanted
}
export function wantReactions(on) { reactionsWanted = on }
// The heading the phones show for a room, found once per deck.
const titlesByDeck = new WeakMap()
function titleFor(deck, room) {
  let titles = titlesByDeck.get(deck)
  if (!titles) titlesByDeck.set(deck, titles = new Map())
  if (!titles.has(room)) titles.set(room, slideTitleFor(deck, room))
  return titles.get(room)
}
// What the phones show for the activity on a slide: its component's `phone`
// description, from the tag's attributes and the slide's heading.
function activityOn(deck, slide) {
  const room = roomsOnSlide(slide)[0]
  if (!room) return { room: null, activity: null }
  const tag = findRoomTag(slide.content ?? '', room) ?? Object.values(slide.regions ?? {}).map(region => findRoomTag(region.content ?? '', room)).find(Boolean)
  const element = tag && new DOMParser().parseFromString(expandPollLists(tag), 'text/html').body.firstElementChild
  const component = element && registry[element.localName]
  if (typeof component?.phone !== 'function') return { room, activity: null }
  const props = Object.fromEntries([...element.attributes].map(attribute => [attribute.name, attribute.value]))
  try { return { room, activity: component.phone(props, { slideTitle: titleFor(deck, room) }) } } catch (error) { console.warn(error); return { room, activity: null } }
}
export function announceSlide(deck, index, { initial = false } = {}) {
  if (hasActivities()) announce({ ...activityOn(deck, deck.slides[index]), title: deck.deckConfig?.meta?.title ?? '', initial })
}
