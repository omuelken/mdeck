import { h } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { useRoom, latestByDevice } from '../live/client.js'
import { t } from '../core/labels.js'
import { JoinCode, ActivityFooter, wantsQr } from './activity.jsx'
import './poll.css'

// <poll room="lunch" question="Where do we eat?" options="Mensa|Thai|Pizza" />
// On the slide: live bars, the number of answers and the deck's join code
// (`qr="false"` leaves it out, when the code was on an earlier slide).
// On the phones, the server's answer page shows one button per option,
// as described by Poll.phone. Each device has one vote and can change it; the
// latest one counts.
//
// `answer="Thai"` (several: "Thai|Pizza") marks the right answer: a button
// with a tick outlines its label, bar and count in green. Showing it is an
// event on the stage (`pollreveal`, { room, shown }), which the ink bus
// passes to the audience window and other devices.

const choicesOf = options => String(options ?? '').split('|').map(option => option.trim()).filter(Boolean)

export default function Poll({ room = 'poll', question = '', options = '', qr, answer = '' }) {
  const choices = choicesOf(options)
  const correct = choicesOf(answer).filter(choice => choices.includes(choice))
  const [shown, setShown] = useState(false)
  const ref = useRef()
  const stage = () => ref.current?.closest('deck-stage')
  useEffect(() => {
    const target = stage()
    if (!target || !correct.length) return
    const onReveal = event => { if (event.detail?.room === room) setShown(!!event.detail.shown) }
    target.addEventListener('pollreveal', onReveal)
    return () => target.removeEventListener('pollreveal', onReveal)
  }, [room, correct.length])
  const toggle = () => {
    const next = !shown
    setShown(next)
    stage()?.dispatchEvent(new CustomEvent('pollreveal', { detail: { room, shown: next, local: true } }))
  }
  const live = useRoom(room)
  const votes = latestByDevice(live.messages).map(message => message.data?.value).filter(vote => choices.includes(vote))
  const counts = choices.map(choice => votes.filter(vote => vote === choice).length)
  const max = Math.max(1, ...counts)
  const code = wantsQr(qr)
  return <div class={`poll${shown ? ' is-solved' : ''}`} ref={ref}>
    <div class="poll-main">
      {question && <p class="poll-question">{question}</p>}
      <div class="poll-bars" role="list">
        {choices.map((choice, i) => <div class={`poll-row${correct.includes(choice) ? ' is-correct' : ''}`} role="listitem" key={choice}>
          <span class="poll-label">{choice}</span>
          <span class="poll-track"><span class="poll-fill" style={{ width: `${(counts[i] / max) * 100}%` }} /></span>
          <span class="poll-count">{counts[i]}</span>
        </div>)}
      </div>
      <ActivityFooter count={votes.length} {...live}>
        {correct.length > 0 && <button type="button" class={`poll-solve${shown ? ' is-on' : ''}`} title={t(shown ? 'poll.hideAnswer' : 'poll.showAnswer')} aria-label={t(shown ? 'poll.hideAnswer' : 'poll.showAnswer')} aria-pressed={shown} onClick={toggle}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
        </button>}
      </ActivityFooter>
    </div>
    <JoinCode room={room} {...live} qr={code} />
  </div>
}

// What the phones show while this poll is on screen.
Poll.phone = ({ question, options }, { slideTitle = '' } = {}) => ({ type: 'choice', question: question || slideTitle, options: choicesOf(options) })
