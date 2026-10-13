import { h } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { listenToReactions } from '../live/client.js'

// The reactions phones send (src/core/reactions.js), on the presenter's
// screen only: each one floats up for a moment, and a tally keeps what came
// in the last minute, so that four 🤔 still say so after they faded.

const FLOAT_MS = 2600
const TALLY_MS = 60000

const CSS = `
.reactions { position: fixed; z-index: 17; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; pointer-events: none; font-family: ui-sans-serif, system-ui, sans-serif; }
.reactions-float { position: relative; width: 160px; height: 220px; }
.reaction-bubble { position: absolute; bottom: 0; font-size: 34px; line-height: 1; animation: reaction-up ${FLOAT_MS}ms ease-out forwards; filter: drop-shadow(0 2px 4px rgba(0,0,0,.45)); }
.reaction-bubble.is-word { font-size: 15px; font-weight: 600; padding: 4px 10px; border-radius: 999px; background: rgba(17,17,17,.9); color: #f0f0f0; border: 1px solid #3a3a3a; }
@keyframes reaction-up { 0% { transform: translate(0, 0) scale(.6); opacity: 0; } 12% { transform: translate(var(--drift), -20px) scale(1.1); opacity: 1; } 75% { opacity: 1; } 100% { transform: translate(calc(var(--drift) * -1), -200px) scale(1); opacity: 0; } }
.reactions-tally { display: flex; flex-wrap: wrap; gap: 4px; padding: 4px 6px; border-radius: 999px; background: rgba(17,17,17,.88); border: 1px solid #2a2a2a; color: #ccc; font-size: 13px; font-variant-numeric: tabular-nums; }
.reactions-tally span { padding: 0 4px; }
@media (prefers-reduced-motion: reduce) { .reaction-bubble { animation: none; opacity: .9; } }
`

const isEmoji = value => /\p{Extended_Pictographic}/u.test(value) && [...value].length <= 4

/** The reactions overlay; `style` places it (fixed by default, at the slide's lower left). */
export function Reactions({ style }) {
  const [bubbles, setBubbles] = useState([])
  const [recent, setRecent] = useState([])
  useEffect(() => {
    const css = document.createElement('style')
    css.textContent = CSS
    document.head.appendChild(css)
    const stop = listenToReactions(({ value, n }) => {
      const now = Date.now()
      const bubble = { key: `${n}:${now}`, value, x: 10 + Math.random() * 100, drift: `${Math.round(Math.random() * 24 - 12)}px` }
      // At most a screenful at once: a room that taps all together is still one cloud.
      setBubbles(list => [...list.slice(-24), bubble])
      setTimeout(() => setBubbles(list => list.filter(item => item !== bubble)), FLOAT_MS)
      setRecent(list => [...list.filter(item => now - item.at < TALLY_MS), { value, at: now }])
    })
    // The tally forgets what is older than a minute.
    const timer = setInterval(() => setRecent(list => { const now = Date.now(); const kept = list.filter(item => now - item.at < TALLY_MS); return kept.length === list.length ? list : kept }), 5000)
    return () => { stop(); clearInterval(timer); css.remove() }
  }, [])
  const tally = new Map()
  for (const { value } of recent) tally.set(value, (tally.get(value) ?? 0) + 1)
  if (!bubbles.length && !tally.size) return null
  return <div class="reactions" aria-hidden="true" style={{ left: '16px', bottom: '16px', ...style }}>
    <div class="reactions-float">
      {bubbles.map(bubble => <span key={bubble.key} class={`reaction-bubble${isEmoji(bubble.value) ? '' : ' is-word'}`} style={{ left: `${bubble.x}px`, '--drift': bubble.drift }}>{bubble.value}</span>)}
    </div>
    {tally.size > 0 && <div class="reactions-tally" title="Reactions in the last minute">
      {[...tally].sort((a, b) => b[1] - a[1]).map(([value, count]) => <span key={value}>{value} {count}</span>)}
    </div>}
  </div>
}
