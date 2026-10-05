import { h } from 'preact'
import QrCode from './QrCode.jsx'
import { t } from '../core/labels.js'

// Parts every activity on a slide shares (<poll>, <question>, <wordcloud>,
// <scale>, and <qrcode join />): the deck's join code and the line with the number of
// answers, the live dot and Reset.

export const shortLink = url => url.replace(/^https?:\/\//, '')
// `qr="false"` (or "no", "off") leaves the code out: it was on an earlier
// slide (<qrcode join />), and people's phones follow along.
export const wantsQr = qr => !/^(false|no|off|0)$/i.test(String(qr ?? 'true'))

/** The join code with the short link, or how to make phones reach the room server. */
export function JoinCode({ room, joinUrl, localJoinUrl, qr = true, size = 300, label = t('poll.scan') }) {
  if (!qr) return null
  if (!joinUrl) return <p class="poll-join poll-join--local">{t('poll.unreachable', { command: <code>mdeck run --host</code>, setting: <code>live.server</code> })} <a href={localJoinUrl} target="_blank" rel="noopener">{t('poll.tryHere')}</a></p>
  return <a class="poll-join" href={joinUrl} target="_blank" rel="noopener" data-room={room}>
    <QrCode url={joinUrl} size={String(size)} />
    <span>{label}</span>
    <span class="poll-link">{shortLink(joinUrl)}</span>
  </a>
}

/** Number of answers, whether the room is live, and Reset for the presenter. */
export function ActivityFooter({ count, connected, canReset, reset }) {
  return <p class="poll-total">
    <span class={`poll-dot${connected ? ' is-live' : ''}`} title={connected ? t('poll.live') : t('poll.offline')} />
    {count === 1 ? t('poll.answer') : t('poll.answers', { n: count })}
    {canReset && count > 0 && <button class="poll-reset" onClick={() => reset().catch(() => {})}>{t('poll.reset')}</button>}
  </p>
}
