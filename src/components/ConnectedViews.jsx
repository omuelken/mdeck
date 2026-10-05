import { h } from 'preact'
import { Icon } from './Icon.jsx'
import { devicesText, phonesText } from '../live/presence.js'

// Who is connected to the deck, as small icons: one per kind of view with a
// count when there are several, and the people whose phones can answer polls. The
// tooltip says which devices. `presence` is { views: [{ view, device }],
// phones } from the room server (src/live/rooms.js).

const VIEW_ICON = { presenter: 'presenter', audience: 'projector', deck: 'slides' }
const VIEW_NAME = { presenter: 'Presenter view', audience: 'Audience window', deck: 'Deck window' }

export function ConnectedViews({ presence, phones = false, size = 14, style }) {
  if (!presence) return null
  const kinds = Object.keys(VIEW_ICON).filter(view => presence.views.some(entry => entry.view === view))
  const items = kinds.map(view => ({ icon: VIEW_ICON[view], count: presence.views.filter(entry => entry.view === view).length, text: `${VIEW_NAME[view]} on ${devicesText(presence.views.filter(entry => entry.view === view))}` }))
  if (phones || presence.phones) items.push({ icon: 'people', count: presence.phones, text: phonesText(presence.phones), always: true })
  if (!items.length) return null
  const summary = `Connected: ${items.map(item => item.text).join(', ')}`
  return <span class="connected-views" role="status" aria-label={summary} title={summary} style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', fontSize: '12px', fontVariantNumeric: 'tabular-nums', ...style }}>
    {items.map(item => <span key={item.icon} title={item.text} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', opacity: item.always && !item.count ? 0.5 : 1 }}>
      <Icon name={item.icon} size={size} />{(item.count > 1 || item.always) && <span>{item.count}</span>}
    </span>)}
  </span>
}
