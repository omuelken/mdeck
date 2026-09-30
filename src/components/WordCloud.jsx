import { h } from 'preact'
import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import cloud from 'd3-cloud'
import { useRoom } from '../live/client.js'
import { JoinCode, ActivityFooter, wantsQr } from './activity.jsx'
import { t } from '../core/labels.js'
import './poll.css'

// <wordcloud room="mood" question="One word for today?" />
// Phones send a word or two, as often as they like. The slide packs every
// answer into a cloud around its middle: the more often it was sent, the
// larger; some stand upright. Answers that differ only in case or spacing
// count together. `height` is the cloud's height in slide pixels (520),
// `limit` the most words shown (60).

// The same answers always give the same cloud, and a new word moves the
// others as little as the layout allows.
function seeded(seed) {
  let state = seed >>> 0 || 1
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 2 ** 32 }
}
const hash = text => [...text].reduce((sum, char) => (sum * 31 + char.codePointAt(0)) >>> 0, 7)

function countWords(messages) {
  const counts = new Map()
  for (const message of messages) {
    const text = String(message.data?.value ?? '').trim().replace(/\s+/g, ' ')
    if (!text) continue
    const key = text.toLocaleLowerCase()
    const entry = counts.get(key) ?? { text, n: 0 }
    entry.n++
    counts.set(key, entry)
  }
  return [...counts.values()].sort((a, b) => b.n - a.n || a.text.localeCompare(b.text))
}

// Places the words (d3-cloud: an Archimedean spiral from the middle, tested
// against the letters' real shapes). When not every word fits, it tries again
// smaller, so no answer is left out.
function layout(words, { width, height, font }) {
  if (!words.length || width < 50) return []
  const most = words[0].n
  const largest = Math.min(150, height * 0.3)
  let placed = []
  for (let scale = 1; scale > 0.3; scale *= 0.82) {
    const top = largest * scale, bottom = Math.max(18, 26 * scale)
    cloud()
      .size([width, height])
      .words(words.map((word, i) => ({
        text: word.text, n: word.n,
        size: bottom + (top - bottom) * Math.sqrt(word.n / most),
        rotate: i > 0 && hash(word.text) % 5 === 0 ? -90 : 0,
      })))
      .font(font).fontWeight('700').fontSize(word => word.size).rotate(word => word.rotate)
      .padding(Math.max(2, 6 * scale)).spiral('archimedean')
      .random(seeded(words.length * 7919 + hash(words[0].text)))
      .timeInterval(Infinity)
      .on('end', output => { placed = output })
      .start()
    if (placed.length === words.length) break
  }
  return placed
}

export default function WordCloud({ room = 'words', question = '', limit = '60', height = '520', qr }) {
  const live = useRoom(room)
  const all = countWords(live.messages)
  const words = all.slice(0, Math.max(1, Number(limit) || 60))
  const total = all.reduce((sum, word) => sum + word.n, 0)
  const cloudHeight = Math.max(200, Number(height) || 520)
  const ref = useRef(null)
  // Slide pixels: the stage scales the whole slide, offsetWidth is unscaled.
  const [measure, setMeasure] = useState({ width: 0, font: 'sans-serif', fontsReady: 0 })
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const read = () => setMeasure(current => ({ ...current, width: element.offsetWidth, font: getComputedStyle(element).fontFamily || 'sans-serif' }))
    read()
    // The theme's font must be there before letters are measured.
    document.fonts?.ready.then(() => setMeasure(current => ({ ...current, fontsReady: current.fontsReady + 1 })))
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(read) : null
    observer?.observe(element)
    return () => observer?.disconnect()
  }, [])
  const key = words.map(word => `${word.text}:${word.n}`).join('|')
  const placed = useMemo(() => layout(words, { width: measure.width, height: cloudHeight, font: measure.font }), [key, measure.width, measure.font, measure.fontsReady, cloudHeight])
  const code = wantsQr(qr)
  return <div class="poll poll--cloud">
    <div class="poll-main">
      {question && <p class="poll-question">{question}</p>}
      <div class="word-cloud" ref={ref} style={{ height: `${cloudHeight}px` }}>
        {words.length
          ? <svg viewBox={`${-measure.width / 2} ${-cloudHeight / 2} ${measure.width || 1} ${cloudHeight}`} width="100%" height="100%" role="img" aria-label={words.map(word => word.text).join(', ')}>
            {placed.map(word => <text key={word.text} class={`word word--${hash(word.text) % 3}`} text-anchor="middle"
              style={{ fontSize: `${word.size}px`, fontFamily: measure.font, transform: `translate(${word.x}px, ${word.y}px) rotate(${word.rotate}deg)` }}>{word.text}</text>)}
          </svg>
          : <p class="question-empty">{t('question.empty')}</p>}
      </div>
      <ActivityFooter count={total} {...live} />
    </div>
    <JoinCode room={room} {...live} qr={code} size={240} />
  </div>
}

WordCloud.phone = ({ question, placeholder }, { slideTitle = '' } = {}) => ({ type: 'text', question: question || slideTitle, placeholder: placeholder ?? '', maxLength: 40 })
