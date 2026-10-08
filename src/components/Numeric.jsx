import { h } from 'preact'
import { useRoom, latestByDevice } from '../live/client.js'
import { t } from '../core/labels.js'
import { JoinCode, ActivityFooter, ActivityQuestion, ActivityControls, useControls, wantsQr } from './activity.jsx'
import { slideHtml, phoneHtml, phoneQuestion } from './inlineText.js'
import { parseNumber, groupNumbers, isRightNumber } from './numbers.js'
import './poll.css'

// <numeric room="limit" question="What is $\lim_{x\to 0} \frac{\sin x}{x}$?" answer="1" tolerance="0.01" />
// Phones type a number (0.5, 0,5 or 1/2); each phone's latest one counts.
// The slide shows the most frequent answers as bars (`limit`, 6 by default)
// and the rest as Other. `answer` and `tolerance` (0 by default) say which
// answers are right: the tick outlines them, says how many were right, and
// tells each phone whether its answer was. Close, Reset and the results
// button work as for a poll.

export default function Numeric({ room = 'numeric', question = '', answer = '', tolerance = '', limit = '6', results = '', qr }) {
  const right = parseNumber(answer)
  const within = Math.max(0, parseNumber(tolerance) ?? 0)
  const live = useRoom(room)
  const controls = useControls(room, live, { results: results !== 'hidden', solution: solutionFor(answer, tolerance, phoneHtml) })
  const texts = latestByDevice(controls.counted(live.messages)).map(message => message.data?.value).filter(value => parseNumber(value) != null)
  const groups = groupNumbers(texts)
  const shown = groups.slice(0, Math.max(1, Number(limit) || 6))
  const other = groups.slice(shown.length).reduce((sum, group) => sum + group.n, 0)
  const rows = [...shown.map(group => ({ ...group, correct: isRightNumber(group.value, right, within) })), ...(other ? [{ text: t('numeric.other'), n: other, other: true }] : [])]
  const max = Math.max(1, ...rows.map(row => row.n))
  const rightCount = right == null ? 0 : groups.filter(group => isRightNumber(group.value, right, within)).reduce((sum, group) => sum + group.n, 0)
  const still = live.offline && !texts.length
  return <div class={`poll poll--numeric${controls.revealed ? ' is-solved' : ''}${still ? ' is-static' : ''}${controls.results ? '' : ' is-results-hidden'}${controls.closed ? ' is-closed' : ''}`} ref={controls.ref}>
    <div class="poll-main">
      <ActivityQuestion text={question} />
      <div class="poll-bars" role="list">
        {rows.map(row => <div class={`poll-row${row.correct ? ' is-correct' : ''}${row.other ? ' is-other' : ''}`} role="listitem" key={row.other ? '' : row.value}>
          <span class="poll-label">{row.text}</span>
          <span class="poll-track"><span class="poll-fill" style={{ width: `${(row.n / max) * 100}%` }} /></span>
          <span class="poll-count">{row.n}</span>
        </div>)}
      </div>
      {!rows.length && !live.offline && <p class="question-empty">{t('question.empty')}</p>}
      {right != null && controls.revealed && <p class="numeric-answer">{t('respond.solution', { answer: <span><span dangerouslySetInnerHTML={{ __html: slideHtml(answer) }} />{within > 0 && ` ± ${tolerance}`}</span> })} · {t('numeric.right', { n: rightCount })}</p>}
      <ActivityFooter count={texts.length} {...live} perPhone reset={controls.reset} closed={controls.closed}>
        <ActivityControls controls={controls} messages={live.messages} offline={live.offline} results solve={right != null} />
      </ActivityFooter>
    </div>
    <JoinCode room={room} {...live} qr={wantsQr(qr)} size={240} />
  </div>
}

// What phones get once the right answer shows: the number, how far off still
// counts, and the answer as written, drawn.
function solutionFor(answer, tolerance, draw) {
  const value = parseNumber(answer)
  if (value == null) return null
  const within = Math.max(parseNumber(tolerance) ?? 0, 1e-9 * Math.max(1, Math.abs(value)))
  return { value, tolerance: within, text: String(answer), html: draw(String(answer)) }
}

Numeric.phone = ({ question, placeholder }, { slideTitle = '' } = {}) => ({ type: 'numeric', ...phoneQuestion(question, slideTitle), placeholder: placeholder ?? '' })
