import { h } from 'preact'
import { useRoom } from '../live/client.js'
import { JoinCode, ActivityFooter, wantsQr } from './activity.jsx'
import { t } from '../core/labels.js'
import './poll.css'

// <question room="ask" question="What should we cover next?" placeholder="Your question" />
// Open answers: phones get a text field and may send as often as they like;
// the slide shows the newest answers as cards (`limit`, 8 by default).

export default function Question({ room = 'question', question = '', limit = '8', qr }) {
  const live = useRoom(room)
  const answers = live.messages.map(message => ({ n: message.n, text: String(message.data?.value ?? '').trim() })).filter(answer => answer.text)
  const shown = answers.slice(-Math.max(1, Number(limit) || 8)).reverse()
  const code = wantsQr(qr)
  return <div class="poll poll--question">
    <div class="poll-main">
      {question && <p class="poll-question">{question}</p>}
      {shown.length
        ? <ul class="question-cards">{shown.map(answer => <li key={answer.n}>{answer.text}</li>)}</ul>
        : !live.offline && <p class="question-empty">{t('question.empty')}</p>}
      <ActivityFooter count={answers.length} {...live} />
    </div>
    <JoinCode room={room} {...live} qr={code} size={240} />
  </div>
}

Question.phone = ({ question, placeholder }, { slideTitle = '' } = {}) => ({ type: 'text', question: question || slideTitle, placeholder: placeholder ?? '', maxLength: 200 })
