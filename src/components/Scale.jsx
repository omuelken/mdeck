import { h } from 'preact'
import { useRoom, latestByDevice } from '../live/client.js'
import { JoinCode, ActivityFooter, ActivityQuestion, wantsQr } from './activity.jsx'
import { slideHtml, phoneHtml, phoneQuestion } from './inlineText.js'
import { t } from '../core/labels.js'
import './poll.css'

// <scale room="pace" question="How is the pace?" min="1" max="5" low="Too slow" high="Too fast" />
// Phones pick a number; each device's latest answer counts. The slide shows
// how many chose each number, and the average. The question and the labels
// are Markdown with $…$ maths, like a poll's.

const bounds = ({ min, max }) => {
  const low = Number.isFinite(Number(min)) && min !== '' && min != null ? Math.round(Number(min)) : 1
  const high = Number.isFinite(Number(max)) && max !== '' && max != null ? Math.round(Number(max)) : 5
  return high > low && high - low <= 10 ? [low, high] : [1, 5]
}

export default function Scale({ room = 'scale', question = '', low = '', high = '', qr, ...rest }) {
  const [min, max] = bounds(rest)
  const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i)
  const live = useRoom(room)
  const values = latestByDevice(live.messages).map(message => Number(message.data?.value)).filter(value => steps.includes(value))
  const counts = steps.map(step => values.filter(value => value === step).length)
  const most = Math.max(1, ...counts)
  const average = values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1) : null
  const code = wantsQr(qr)
  return <div class={`poll poll--scale${live.offline && !values.length ? ' is-static' : ''}`}>
    <div class="poll-main">
      <ActivityQuestion text={question} />
      <div class="scale-columns" role="list">
        {steps.map((step, i) => <div class="scale-column" role="listitem" key={step}>
          <span class="scale-count">{counts[i]}</span>
          <span class="scale-track"><span class="scale-fill" style={{ height: `${(counts[i] / most) * 100}%` }} /></span>
          <span class="scale-step">{step}</span>
        </div>)}
      </div>
      {(low || high) && <p class="scale-labels"><span dangerouslySetInnerHTML={{ __html: slideHtml(low) }} /><span dangerouslySetInnerHTML={{ __html: slideHtml(high) }} /></p>}
      <ActivityFooter count={values.length} {...live} />
      {average && <p class="scale-average">{t('scale.average', { n: average })}</p>}
    </div>
    <JoinCode room={room} {...live} qr={code} size={240} />
  </div>
}

Scale.phone = ({ question, low, high, ...rest }, { slideTitle = '' } = {}) => {
  const [min, max] = bounds(rest)
  return { type: 'scale', ...phoneQuestion(question, slideTitle), min, max, minLabel: low ?? '', maxLabel: high ?? '', ...(low ? { minLabelHtml: phoneHtml(low) } : {}), ...(high ? { maxLabelHtml: phoneHtml(high) } : {}) }
}
