import { h } from 'preact'
import { useRoom } from '../live/client.js'
import { JoinCode, ActivityFooter, ActivityQuestion, ActivityControls, useControls, wantsQr } from './activity.jsx'
import { phoneQuestion } from './inlineText.js'
import { t } from '../core/labels.js'
import './poll.css'

// <question room="ask" question="What should we cover next?" placeholder="Your question" />
// Open answers: phones get a text field and may send as often as they like;
// the slide shows the newest answers as cards (`limit`, 8 by default).

export default function Question({ room = 'question', question = '', limit = '8', qr }) {
  const live = useRoom(room)
  const controls = useControls(room, live)
  const answers = controls.counted(live.messages).map(message => ({ n: message.n, text: String(message.data?.value ?? '').trim() })).filter(answer => answer.text)
  const shown = answers.slice(-Math.max(1, Number(limit) || 8)).reverse()
  const code = wantsQr(qr)
  return <div class={`poll poll--question${controls.closed ? ' is-closed' : ''}`} ref={controls.ref}>
    <div class="poll-main">
      <ActivityQuestion text={question} />
      {shown.length
        ? <ul class="question-cards">{shown.map(answer => <li key={answer.n}>{answer.text}</li>)}</ul>
        : !live.offline && <p class="question-empty">{t('question.empty')}</p>}
      <ActivityFooter count={answers.length} {...live} reset={controls.reset} closed={controls.closed}>
        <ActivityControls controls={controls} messages={live.messages} offline={live.offline} />
      </ActivityFooter>
    </div>
    <JoinCode room={room} {...live} qr={code} size={240} />
  </div>
}

Question.phone = ({ question, placeholder }, { slideTitle = '' } = {}) => ({ type: 'text', ...phoneQuestion(question, slideTitle), placeholder: placeholder ?? '', maxLength: 200 })
