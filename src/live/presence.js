// Who is connected to a deck: each presenter, audience and deck window says
// what it is when it connects to the stage room, and the answer page counts
// as a phone. The server tells windows that ask (?presence=1) who is there;
// see src/live/rooms.js and src/components/ConnectedViews.jsx.

/** This device, roughly: an iPad says it is a Mac, but has a touch screen. */
export function deviceKind(nav = typeof navigator === 'undefined' ? {} : navigator) {
  const agent = nav.userAgent ?? ''
  if (/iPad/.test(agent) || (/Macintosh/.test(agent) && nav.maxTouchPoints > 1)) return 'ipad'
  if (/iPhone|iPod|Android.*Mobile/.test(agent)) return 'phone'
  if (/Android|Tablet/.test(agent)) return 'tablet'
  return 'computer'
}

/** The query that counts this window as `view`, and asks for presence too. */
export function presenceQuery({ view = null, listen = false } = {}) {
  const query = new URLSearchParams()
  if (view) { query.set('view', view); query.set('device', deviceKind()) }
  if (listen) query.set('presence', '1')
  return query.toString()
}

const DEVICE_NAME = { computer: 'a computer', ipad: 'an iPad', tablet: 'a tablet', phone: 'a phone' }
const list = words => words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`

/** The devices of some connected views, as words: "an iPad and 2 computers". */
export function devicesText(views) {
  const counts = {}
  for (const entry of views) counts[entry.device] = (counts[entry.device] ?? 0) + 1
  return list(Object.entries(counts).map(([device, n]) => n === 1 ? DEVICE_NAME[device] : `${n} ${device === 'ipad' ? 'iPads' : `${device}s`}`))
}

export const phonesText = n => `${n} phone${n === 1 ? '' : 's'}`
