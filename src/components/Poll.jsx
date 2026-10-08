import { h } from 'preact'
import { useRoom, latestByDevice } from '../live/client.js'
import { t } from '../core/labels.js'
import { JoinCode, ActivityFooter, ActivityQuestion, ActivityControls, useControls, wantsQr, isSet } from './activity.jsx'
import { choicesOf, slideHtml, phoneHtml, phoneQuestion } from './inlineText.js'
import './poll.css'

// <poll room="lunch" question="Where do we eat?" options="Mensa|Thai|Pizza" />
// On the slide: live bars, the number of answers and the deck's join code
// (`qr="false"` leaves it out, when the code was on an earlier slide).
// On the phones, the server's answer page shows one button per option,
// as described by Poll.phone. Each device has one vote and can change it; the
// latest one counts.
//
// `multiple` lets each phone pick several options; the slide and the phones
// say so. A vote is then the list of options picked.
//
// `buttons="letters"` (or "numbers") puts A, B, C… (1, 2, 3…) before the
// options on the slide, and the phones show only those: for options that are
// pictures, long formulas, or anything else better read on the big screen.
//
// `answer="Thai"` (several: "Thai|Pizza") marks the right answer: a button
// with a tick outlines its label, bar and count in green, and phones say
// whether theirs was right. A button with a lock closes the poll: later votes
// do not count, and phones cannot vote until it opens again. A button with
// an eye shows or hides the results (bars and counts); `results="hidden"`
// starts with them hidden, e.g. for peer instruction. Hidden, the audience
// window shows no bars; the presenter's own screens show them faint, so the
// presenter can still judge the votes. All of them reach every screen of
// the talk (useControls in activity.jsx).
//
// The question and the options are Markdown with $…$ maths, as on a slide:
// options="$x^2$|$2x$|$\frac{x^3}{3}$". A bar inside a formula stays in it
// ($|x|$); \| is a bar in the text. Votes and `answer` use the source text.

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
/** What `buttons` puts before each option: letters, numbers, or nothing. */
export const keysFor = (buttons, count) => {
  const kind = String(buttons ?? '').toLowerCase()
  if (kind === 'letters') return Array.from({ length: count }, (_, i) => LETTERS[i] ?? String(i + 1))
  if (kind === 'numbers') return Array.from({ length: count }, (_, i) => String(i + 1))
  return null
}

// A vote: one option, or with `multiple` the options picked. A phone page
// from before `multiple` sends one option; it counts as a list of one.
const picksOf = (value, multiple) => multiple ? (Array.isArray(value) ? value : [value]) : (Array.isArray(value) ? [] : [value])

export default function Poll({ room = 'poll', question = '', options = '', qr, answer = '', results = '', multiple, buttons }) {
  const choices = choicesOf(options)
  const several = isSet(multiple)
  const keys = keysFor(buttons, choices.length)
  const correct = choicesOf(answer).filter(choice => choices.includes(choice))
  const live = useRoom(room)
  const controls = useControls(room, live, { results: results !== 'hidden', solution: correct.length ? correct : null })
  const votes = latestByDevice(controls.counted(live.messages))
    .map(message => picksOf(message.data?.value, several).filter(pick => choices.includes(pick)))
    .filter(picks => picks.length)
  const counts = choices.map(choice => votes.filter(picks => picks.includes(choice)).length)
  const max = Math.max(1, ...counts)
  const code = wantsQr(qr)
  const still = live.offline && !votes.length
  return <div class={`poll${controls.revealed ? ' is-solved' : ''}${still ? ' is-static' : ''}${controls.results ? '' : ' is-results-hidden'}${controls.closed ? ' is-closed' : ''}`} ref={controls.ref}>
    <div class="poll-main">
      <ActivityQuestion text={question} />
      {several && <p class="poll-several">{t('poll.several')}</p>}
      <div class="poll-bars" role="list">
        {choices.map((choice, i) => <div class={`poll-row${correct.includes(choice) ? ' is-correct' : ''}`} role="listitem" key={choice}>
          <span class="poll-label">{keys && <span class="poll-key">{keys[i]}</span>}<span dangerouslySetInnerHTML={{ __html: slideHtml(choice) }} /></span>
          <span class="poll-track"><span class="poll-fill" style={{ width: `${(counts[i] / max) * 100}%` }} /></span>
          <span class="poll-count">{counts[i]}</span>
        </div>)}
      </div>
      <ActivityFooter count={votes.length} {...live} perPhone reset={controls.reset} closed={controls.closed}>
        <ActivityControls controls={controls} messages={live.messages} offline={live.offline} results solve={correct.length > 0} />
      </ActivityFooter>
    </div>
    <JoinCode room={room} {...live} qr={code} />
  </div>
}

// What the phones show while this poll is on screen. `optionsHtml` are the
// options drawn, with maths as MathML; with `buttons`, phones show `keys`
// instead. An answer page from before them shows `question` and `options`.
Poll.phone = ({ question, options, multiple, buttons }, { slideTitle = '' } = {}) => {
  const choices = choicesOf(options)
  const keys = keysFor(buttons, choices.length)
  return {
    type: 'choice', ...phoneQuestion(question, slideTitle), options: choices,
    ...(keys ? { keys } : { optionsHtml: choices.map(phoneHtml) }),
    ...(isSet(multiple) ? { multiple: true } : {}),
  }
}
