import { h } from 'preact'
import QrCode from './QrCode.jsx'
import { useJoinLink } from '../live/client.js'
import { JoinCode } from './activity.jsx'
import { t } from '../core/labels.js'
import './poll.css'

// <qrcode url="https://example.com" size="240" /> on a slide.
// Without `url`: the deck's join link for audience questions, with the short
// link below it, so a slide early in the talk can invite everyone once and
// the questions after it can leave out their own code (`qr="false"`).

function JoinQr({ size }) {
  const link = useJoinLink()
  return <div class="poll-join-slide">
    <JoinCode {...link} size={Number(size) || 420} label={t('join.scan')} />
  </div>
}

export default function QrCodeTag({ url, size }) {
  return url ? <QrCode url={url} size={size ?? '200'} /> : <JoinQr size={size} />
}
