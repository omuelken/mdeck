import { h } from 'preact'
import { useState } from 'preact/hooks'
import { useRoom, responding, latestByDevice, respondingSlideTitle } from '../live/client.js'
import QrCode from './QrCode.jsx'
import { t } from '../core/labels.js'
import './poll.css'

// <poll room="lunch" question="Where do we eat?" options="Mensa|Thai|Pizza" />
// On the slide: live bars, the number of answers and a QR code. On a phone
// that scanned it: one button per option. Each device has one vote and can
// change it; the latest one counts.

function Results({ question, choices, counts, total, joinUrl, connected, canReset, reset }) {
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
        {total === 1 ? t('poll.answer') : t('poll.answers', { n: total })}
        {canReset && total > 0 && <button class="poll-reset" onClick={() => reset().catch(() => {})}>{t('poll.reset')}</button>}
      </p>
    </div>
    {joinUrl
      ? <a class="poll-join" href={joinUrl} target="_blank" rel="noopener">
        <QrCode url={joinUrl} size="300" />
        <span>{t('poll.scan')}</span>
      </a>
      : <p class="poll-join poll-join--local">{t('poll.unreachable', { command: <code>mdeck dev --host</code>, setting: <code>live.audience</code> })}</p>}
  </div>
}

function Answer({ question, choices, send, mine }) {
  const [picked, setPicked] = useState(mine)
  const [error, setError] = useState('')
  const pick = async choice => {
    setError('')
    try { await send({ vote: choice }); setPicked(choice) } catch (e) { setError(e.message) }
  }
  return <div class="poll-answer">
    {question && <h1>{question}</h1>}
    <div class="poll-options">
      {choices.map(choice => <button key={choice} class={picked === choice ? 'is-picked' : ''} aria-pressed={picked === choice} onClick={() => pick(choice)}>{choice}</button>)}
    </div>
    <p class="poll-status" role="status">{error || (picked ? t('poll.thanks', { choice: picked }) : t('poll.pick'))}</p>
  </div>
}

export default function Poll({ room = 'poll', question = '', options = '' }) {
  const choices = options.split('|').map(option => option.trim()).filter(Boolean)
  const live = useRoom(room, { listen: true })
  const votes = latestByDevice(live.messages).map(message => message.data?.vote).filter(vote => choices.includes(vote))
  if (responding(room)) {
    const mine = latestByDevice(live.messages.filter(message => message.from === live.me))[0]?.data?.vote ?? null
    return <Answer key={mine} question={question || respondingSlideTitle()} choices={choices} send={live.send} mine={mine} />
  }
  return <Results question={question} choices={choices} counts={choices.map(choice => votes.filter(vote => vote === choice).length)} total={votes.length} {...live} />
}
