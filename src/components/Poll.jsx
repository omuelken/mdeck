import { h } from 'preact'
import { useRoom, latestByDevice } from '../live/client.js'
import { JoinCode, ActivityFooter, wantsQr } from './activity.jsx'
import './poll.css'

// <poll room="lunch" question="Where do we eat?" options="Mensa|Thai|Pizza" />
// On the slide: live bars, the number of answers and the deck's join code
// (`qr="false"` leaves it out, when the code was on an earlier slide).
// On the phones, the room server's answer page shows one button per option,
// as described by Poll.phone. Each device has one vote and can change it; the
// latest one counts.

const choicesOf = options => String(options ?? '').split('|').map(option => option.trim()).filter(Boolean)

export default function Poll({ room = 'poll', question = '', options = '', qr }) {
  const choices = choicesOf(options)
  const live = useRoom(room)
  const votes = latestByDevice(live.messages).map(message => message.data?.value).filter(vote => choices.includes(vote))
  const counts = choices.map(choice => votes.filter(vote => vote === choice).length)
  const max = Math.max(1, ...counts)
  const code = wantsQr(qr)
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
      <ActivityFooter count={votes.length} {...live} />
    </div>
    <JoinCode room={room} {...live} qr={code} />
  </div>
}

// What the phones show while this poll is on screen.
Poll.phone = ({ question, options }, { slideTitle = '' } = {}) => ({ type: 'choice', question: question || slideTitle, options: choicesOf(options) })
