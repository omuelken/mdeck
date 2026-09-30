import { h } from 'preact'
import { useJoinLink } from '../live/client.js'
import { JoinCode } from './activity.jsx'
import { t } from '../core/labels.js'
import './poll.css'

// <join />: the deck's join code, large, once at the start of a talk. People
// scan it once; their phones then follow to each activity, which can leave
// out its own code with `qr="false"`.

export default function Join({ size = '420' }) {
  const link = useJoinLink()
  return <div class="poll-join-slide">
    <JoinCode {...link} size={Number(size) || 420} label={t('join.scan')} />
    {link.joinUrl && <p class="poll-join-hint">{t('join.hint')}</p>}
  </div>
}
