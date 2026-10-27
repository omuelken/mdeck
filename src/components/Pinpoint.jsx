import { h } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { useRoom, latestByDevice } from '../live/client.js'
import { t } from '../core/labels.js'
import { JoinCode, ActivityFooter, ActivityQuestion, ActivityControls, useControls, wantsQr } from './activity.jsx'
import { phoneQuestion } from './inlineText.js'
import { tapOf, parseTarget, targetOn, solutionOf, isInside } from './pinpoint.js'
import './poll.css'

// <pinpoint room="heart" question="Where is the left atrium?" src="heart.png" answer="412 230 40" />
// Phones show the picture and send where they tapped; each phone's latest
// tap counts. The slide shows every tap as a dot on the picture. `answer`
// names circles, rectangles or polygons (src/components/pinpoint.js): the
// tick draws them, colours the dots inside and outside, counts those inside
// and tells each phone whether its tap was. Close, Reset and the results button work as for a poll.
//
// Phones never load the deck: the presenter's screen sends them this
// picture, made smaller, through the room server (src/live/client.js). It
// finds the picture by `data-pinpoint`.

export default function Pinpoint({ room = 'pinpoint', question = '', src = '', alt = '', answer = '', height = '', results = '', qr }) {
  const picture = useRef()
  const [size, setSize] = useState(null)
  const measure = () => { const img = picture.current; if (img?.naturalWidth) setSize({ width: img.naturalWidth, height: img.naturalHeight }) }
  // A picture from the cache may have loaded before onLoad was listening.
  useEffect(() => { if (picture.current?.complete) measure() }, [src])
  const target = parseTarget(answer)
  const shapes = targetOn(target, size)
  const live = useRoom(room)
  const controls = useControls(room, live, { results: results !== 'hidden', solution: solutionOf(shapes) })
  const taps = latestByDevice(controls.counted(live.messages)).map(message => tapOf(message.data?.value)).filter(Boolean)
  const shown = shapes && controls.revealed
  const inside = shown ? taps.filter(tap => isInside(tap, shapes)).length : 0
  const still = live.offline && !taps.length
  const place = ({ x, y }) => ({ left: `${x * 100}%`, top: `${y * 100}%` })
  const outline = (shape, i) => shape.type === 'poly'
    ? <svg key={i} class="pinpoint-target is-poly" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points={shape.points.map(({ x, y }) => `${x * 100},${y * 100}`).join(' ')} /></svg>
    : shape.type === 'rect'
      ? <span key={i} class="pinpoint-target is-rect" style={{ ...place(shape), width: `${shape.w * 100}%`, height: `${shape.h * 100}%` }} />
      : <span key={i} class="pinpoint-target" style={{ ...place(shape), width: `${shape.r * 200}%`, height: `${(shape.r * 200) / shape.ratio}%` }} />
  return <div class={`poll poll--pinpoint${controls.revealed ? ' is-solved' : ''}${still ? ' is-static' : ''}${controls.results ? '' : ' is-results-hidden'}${controls.closed ? ' is-closed' : ''}`} ref={controls.ref}>
    <div class="poll-main">
      <ActivityQuestion text={question} />
      <div class="pinpoint-picture" style={Number(height) > 0 ? { '--pinpoint-height': `${Number(height)}px` } : null}>
        <img ref={picture} src={src} alt={alt} data-pinpoint={room} draggable={false} onLoad={measure} />
        {shown && shapes.map(outline)}
        {taps.map((tap, i) => <span key={i} class={`pinpoint-dot${shown ? (isInside(tap, shapes) ? ' is-in' : ' is-out') : ''}`} style={place(tap)} />)}
      </div>
      {shown && <p class="numeric-answer">{t('pinpoint.inside', { n: inside, of: taps.length })}</p>}
      <ActivityFooter count={taps.length} {...live} perPhone reset={controls.reset} closed={controls.closed}>
        <ActivityControls controls={controls} messages={live.messages} offline={live.offline} results solve={!!target} />
      </ActivityFooter>
    </div>
    <JoinCode room={room} {...live} qr={wantsQr(qr)} size={240} />
  </div>
}

// What the phones show: the question and, once the presenter's screen has
// sent it, the picture (`image`, src/live/client.js).
Pinpoint.phone = ({ question }, { slideTitle = '' } = {}) => ({ type: 'pin', ...phoneQuestion(question, slideTitle), image: null })
