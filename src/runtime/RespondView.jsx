import { h } from 'preact'
import { HtmlContent } from '../templates/templateApi.jsx'
import { findRoomTag, slideTitleFor } from '../live/roomTag.js'
import { setRespondingSlideTitle } from '../live/client.js'

// `?view=respond&room=<name>`: the page a phone opens from a slide's QR code.
// It renders only the component whose `room` attribute matches, in the deck's
// theme; the component sees `responding(room)` and shows its answer form.

export function RespondView({ deck, deckConfig, room }) {
  const tag = room ? findRoomTag(deck.source, room) : null
  if (tag) setRespondingSlideTitle(slideTitleFor(deck, room))
  const title = deckConfig.meta?.title
  return <main class="respond">
    {tag
      ? <HtmlContent class="respond-body" html={tag} />
      : <p class="respond-missing">This question is not in the presentation any more. Ask the presenter for the current code.</p>}
    {title && <footer class="respond-footer">{title}</footer>}
  </main>
}
