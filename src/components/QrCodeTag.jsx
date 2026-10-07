import { h } from 'preact'
import QrCode from './QrCode.jsx'
import { useJoinLink, useFollowLink } from '../live/client.js'
import { JoinCode } from './activity.jsx'
import { t } from '../core/labels.js'
import './poll.css'

// <qrcode url="https://example.com" size="240" /> on a slide.
// <qrcode join />: the deck's join link for audience questions, with the
// short link below it, so a slide early in the talk can invite everyone once
// and the questions after it can leave out their own code (`qr="false"`).
// <qrcode follow />: the link for following the slides on a phone or laptop.

function JoinQr({ size }) {
  const link = useJoinLink()
  return <div class="poll-join-slide">
    {link.offline && <p class="poll-static">{t('join.static')}</p>}
    <JoinCode {...link} size={Number(size) || 420} label={t('join.scan')} />
  </div>
}

function FollowQr({ size }) {
  const link = useFollowLink()
  return <div class="poll-join-slide">
    <JoinCode {...link} size={Number(size) || 420} label={t('follow.scan')} tryHere={t('follow.tryHere')} />
  </div>
}

// A bare `join` attribute arrives as "", so only "false" and the like turn it off.
const isOn = value => value != null && !/^(false|no|off|0)$/i.test(String(value))

export default function QrCodeTag({ url, join, follow, size }) {
  if (isOn(join)) return <JoinQr size={size} />
  if (isOn(follow)) return <FollowQr size={size} />
  return <QrCode url={url} size={size ?? '200'} />
}
