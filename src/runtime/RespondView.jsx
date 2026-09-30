import { h } from 'preact'
import { HtmlContent } from '../templates/templateApi.jsx'
import { findRoomTag, slideTitleFor, roomsIn } from '../live/roomTag.js'
import { setRespondingSlideTitle, setFollowedRoom, useStage } from '../live/client.js'
import { t } from '../core/labels.js'

// `?view=respond`: the page phones open from any activity's QR code. It
// follows the presentation and shows the activity on the presenter's current
// slide, or a waiting note between them. `&room=<name>` shows one activity
// directly. Either way only that component is rendered, in the deck's theme,
// and it sees `responding(room)` so it shows its answer form.

function Activity({ deck, room }) {
  const tag = findRoomTag(deck.source, room)
  if (!tag) return <p class="respond-note">{t('respond.missing')}</p>
  setRespondingSlideTitle(slideTitleFor(deck, room))
  return <HtmlContent key={room} class="respond-body" html={tag} />
}

function Follow({ deck }) {
  const stage = useStage()
  setFollowedRoom(stage.room)
  if (stage.room) return <Activity key={stage.room} deck={deck} room={stage.room} />
  const rooms = roomsIn(deck.source)
  return <div class="respond-note">
    <p>{t('respond.waiting')}</p>
    {!stage.announced && rooms.length > 0 && <>
      <p>{t('respond.choose')}</p>
      <ul class="respond-rooms">{rooms.map(({ room }) => <li key={room}><a href={`?view=respond&room=${encodeURIComponent(room)}`}>{slideTitleFor(deck, room) || room}</a></li>)}</ul>
    </>}
  </div>
}

export function RespondView({ deck, deckConfig, room }) {
  const title = deckConfig.meta?.title
  return <main class="respond">
    {room ? <Activity deck={deck} room={room} /> : <Follow deck={deck} />}
    {title && <footer class="respond-footer">{title}</footer>}
  </main>
}
