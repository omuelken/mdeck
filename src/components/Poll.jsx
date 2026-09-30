import { h } from 'preact'
import { useRoom, latestByDevice } from '../live/client.js'
import QrCode from './QrCode.jsx'
import { t } from '../core/labels.js'
import './poll.css'

// <poll room="lunch" question="Where do we eat?" options="Mensa|Thai|Pizza" />
// On the slide: live bars, the number of answers and the deck's join link.
// On the phones, the room server's answer page shows one button per option,
// as described by Poll.phone. Each device has one vote and can change it; the
// latest one counts.

const choicesOf = options => String(options ?? '').split('|').map(option => option.trim()).filter(Boolean)
const shortLink = url => url.replace(/^https?:\/\//, '')

export default function Poll({ room = 'poll', question = '', options = '' }) {
  const choices = choicesOf(options)
  const { messages, joinUrl, localJoinUrl, connected, canReset, reset } = useRoom(room)
  const votes = latestByDevice(messages).map(message => message.data?.value).filter(vote => choices.includes(vote))
  const counts = choices.map(choice => votes.filter(vote => vote === choice).length)
  const max = Math.max(1, ...counts)
  return <div class="poll">
    <div class="poll-main">
      {question && <p class="poll-question">{question}</p>}
      <div class="poll-bars" role="list">
        {choices.map((choice, i) => <div class="poll-row" role="listitem" key={choice}>
          <span class="poll-label">{choice}</span>
          <span class="poll-track"><span class="poll-fill" style={{ width: `${(counts[i] / max) * 100}%` }} /></span>
          <span class="poll-count">{counts[i]}</span>
        </div>)}
      </div>
      <p class="poll-total">
        <span class={`poll-dot${connected ? ' is-live' : ''}`} title={connected ? t('poll.live') : t('poll.offline')} />
        {votes.length === 1 ? t('poll.answer') : t('poll.answers', { n: votes.length })}
        {canReset && votes.length > 0 && <button class="poll-reset" onClick={() => reset().catch(() => {})}>{t('poll.reset')}</button>}
      </p>
    </div>
    {joinUrl
      ? <a class="poll-join" href={joinUrl} target="_blank" rel="noopener">
        <QrCode url={joinUrl} size="300" />
        <span>{t('poll.scan')}</span>
        <span class="poll-link">{shortLink(joinUrl)}</span>
      </a>
      : <p class="poll-join poll-join--local">{t('poll.unreachable', { command: <code>mdeck dev --host</code>, setting: <code>live.server</code> })} <a href={localJoinUrl} target="_blank" rel="noopener">{t('poll.tryHere')}</a></p>}
  </div>
}

// What the phones show while this poll is on screen.
Poll.phone = ({ question, options }, { slideTitle = '' } = {}) => ({ type: 'choice', question: question || slideTitle, options: choicesOf(options) })
