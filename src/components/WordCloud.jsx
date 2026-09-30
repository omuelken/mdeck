import { h } from 'preact'
import { useRoom } from '../live/client.js'
import { JoinCode, ActivityFooter, wantsQr } from './activity.jsx'
import { t } from '../core/labels.js'
import './poll.css'

// <wordcloud room="mood" question="One word for today?" />
// Phones send a word or two, as often as they like; the slide shows every
// answer, the more often it was sent, the larger. Answers that differ only in
// case or spacing count together.

export default function WordCloud({ room = 'words', question = '', limit = '40', qr }) {
  const live = useRoom(room)
  const counts = new Map()
  for (const message of live.messages) {
    const text = String(message.data?.value ?? '').trim().replace(/\s+/g, ' ')
    if (!text) continue
    const key = text.toLocaleLowerCase()
    const entry = counts.get(key) ?? { text, n: 0 }
    entry.n++
    counts.set(key, entry)
  }
  const words = [...counts.values()].sort((a, b) => b.n - a.n || a.text.localeCompare(b.text)).slice(0, Math.max(1, Number(limit) || 40))
  const most = words[0]?.n ?? 1
  // Largest in the middle: alternate the sorted words to both sides.
  const arranged = words.reduce((list, word, i) => i % 2 ? [...list, word] : [word, ...list], [])
  const total = [...counts.values()].reduce((sum, word) => sum + word.n, 0)
  const code = wantsQr(qr)
  return <div class="poll poll--cloud">
    <div class="poll-main">
      {question && <p class="poll-question">{question}</p>}
      {words.length
        ? <p class="word-cloud">{arranged.map(word => <span key={word.text} class={`word word--${word.text.length % 3}`} style={{ fontSize: `${0.7 + 1.8 * Math.sqrt(word.n / most)}em` }}>{word.text}</span>)}</p>
        : <p class="question-empty">{t('question.empty')}</p>}
      <ActivityFooter count={total} {...live} showLink={!code} />
    </div>
    <JoinCode room={room} {...live} qr={code} size={240} />
  </div>
}

WordCloud.phone = ({ question, placeholder }, { slideTitle = '' } = {}) => ({ type: 'text', question: question || slideTitle, placeholder: placeholder ?? '', maxLength: 40 })
