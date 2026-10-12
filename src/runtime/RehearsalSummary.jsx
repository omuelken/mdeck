// The end of a rehearsal: each slide's planned time, the time it got, and
// the time to save, which starts at the rehearsed time rounded to 15 s and
// can be moved in 15 s steps, put back to the plan, or taken out. Saving
// writes `time:` into the slides' settings through `mdeck run`
// (build/timingPlugin.js); a built deck can only copy the times.
import { h } from 'preact'
import { useEffect, useMemo, useState } from 'preact/hooks'
import { S } from './chrome.jsx'
import { Icon } from '../components/Icon.jsx'
import { slideTitle } from '../core/outline.js'
import { devPath } from '../core/devPath.js'
import { pairHeaders } from '../live/pairing.js'
import { formatTime, formatClock, roundTime, initialTimes, changedTimes, TIME_STEP } from '../core/timing.js'

const ENDPOINT = devPath('__mdeck/timing')

// Whether this page can save into the deck: only `mdeck run` answers.
async function canSaveTimes() {
  try { return (await fetch(ENDPOINT, { cache: 'no-store', headers: pairHeaders() })).ok } catch { return false }
}

const dash = <span style={{ color: '#555' }}>—</span>
const sum = values => values.reduce((total, t) => total + (t ?? 0), 0)

export function RehearsalSummary({ slides, plan, spent, onSaved, onDiscard, onClose }) {
  const own = plan.own
  const [next, setNext] = useState(() => initialTimes(slides, spent, own))
  const [canSave, setCanSave] = useState(null)
  const [status, setStatus] = useState(null)
  useEffect(() => { canSaveTimes().then(setCanSave) }, [])
  const changes = useMemo(() => changedTimes(slides, own, next), [next])
  const changeCount = Object.keys(changes).length
  const setAt = (i, value) => setNext(times => times.map((t, j) => j === i ? value : t))
  const step = (i, by) => setAt(i, Math.max(TIME_STEP, (next[i] ?? roundTime(spent[slides[i].id] ?? 0)) + by))

  async function save() {
    setStatus({ busy: true })
    try {
      const reply = await fetch(ENDPOINT, { method: 'POST', headers: pairHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ ids: slides.map(slide => slide.id), times: changes }) })
      const body = await reply.json().catch(() => ({}))
      if (!reply.ok) return setStatus({ error: body.error ?? `The deck was not saved (${reply.status})` })
      onSaved(changes, body.changed ?? changeCount)
    } catch (error) {
      setStatus({ error: `The deck was not saved: ${error.message}` })
    }
  }

  function copy() {
    const text = slides.map((slide, i) => `${i + 1}. ${slideTitle(slide, i, null)}: ${next[i] == null ? '—' : `time: ${formatTime(next[i])}`}`).join('\n')
    navigator.clipboard?.writeText(text).then(() => setStatus({ note: 'Copied the times.' }), () => setStatus({ error: 'The browser did not let this page copy.' }))
  }

  function onRowKey(event, i) {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      event.stopPropagation()
      step(i, event.key === 'ArrowUp' ? TIME_STEP : -TIME_STEP)
    }
  }

  const small = { ...S.btn, padding: 0, width: '26px', height: '26px' }
  const cell = { padding: '6px 8px', borderBottom: '1px solid #222', verticalAlign: 'middle' }
  const head = { ...cell, ...S.label, display: 'table-cell', marginBottom: 0, textAlign: 'start', position: 'sticky', top: 0, background: '#161616' }
  const num = { ...cell, textAlign: 'end', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }

  return (
    <div class="rehearsal-summary" role="dialog" aria-modal="true" aria-label="Rehearsal" style={{ position: 'fixed', inset: 0, zIndex: 210, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'ui-sans-serif, system-ui, sans-serif', fontSize: '13px', color: '#ccc' }}
      onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') onClose() }}>
      <div style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '20px 24px', width: 'min(94vw, 760px)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' }}>
          <span style={{ fontWeight: 600, color: '#f0f0f0', fontSize: '15px' }}>Rehearsal</span>
          <span style={{ color: '#888' }}>New times start at the rehearsed time, rounded to {TIME_STEP} s. ↑ ↓ change the focused one.</span>
        </div>
        <div style={{ overflow: 'auto', minHeight: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={head}>Slide</th>
                <th style={{ ...head, textAlign: 'end' }}>Planned</th>
                <th style={{ ...head, textAlign: 'end' }}>Rehearsed</th>
                <th style={{ ...head, textAlign: 'center' }}>New time</th>
              </tr>
            </thead>
            <tbody>
              {slides.map((slide, i) => {
                const changed = next[i] !== own[i]
                return (
                  <tr key={`${slide.id}#${i}`} class="rehearsal-row" tabIndex={0} onKeyDown={event => onRowKey(event, i)} style={{ outline: 'none' }}>
                    <td style={{ ...cell, maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ color: '#666', marginInlineEnd: '8px', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>{slideTitle(slide, i, null)}
                    </td>
                    <td style={{ ...num, color: '#888' }}>{own[i] == null ? dash : formatTime(own[i])}</td>
                    <td style={{ ...num, color: '#888' }}>{spent[slide.id] >= 1 ? formatClock(spent[slide.id]) : dash}</td>
                    <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <button style={small} title={`${TIME_STEP} s less`} aria-label={`${TIME_STEP} seconds less`} onClick={() => step(i, -TIME_STEP)}><Icon name="remove" size={14} /></button>
                        <span class="rehearsal-time" style={{ display: 'inline-block', minWidth: '56px', textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: changed ? '#f0f0f0' : '#888', fontWeight: changed ? 600 : 400 }}>{next[i] == null ? dash : formatTime(next[i])}</span>
                        <button style={small} title={`${TIME_STEP} s more`} aria-label={`${TIME_STEP} seconds more`} onClick={() => step(i, TIME_STEP)}><Icon name="add" size={14} /></button>
                        <button style={{ ...small, visibility: changed ? 'visible' : 'hidden' }} title="Keep the planned time" aria-label="Keep the planned time" onClick={() => setAt(i, own[i])}><Icon name="undo" size={14} /></button>
                        <button style={{ ...small, visibility: next[i] == null ? 'hidden' : 'visible' }} title="No time for this slide" aria-label="No time for this slide" onClick={() => setAt(i, null)}><Icon name="close" size={14} /></button>
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ ...cell, color: '#888' }}>Total{plan.budget ? ` (deck time ${formatClock(plan.budget)})` : ''}</td>
                <td style={num}>{formatClock(sum(own))}</td>
                <td style={num}>{formatClock(sum(Object.values(spent)))}</td>
                <td style={{ ...num, textAlign: 'center', color: plan.budget && sum(next) > plan.budget ? '#f28b82' : '#f0f0f0' }}>{formatClock(sum(next))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span role="status" style={{ flex: 1, color: status?.error ? '#f28b82' : '#888' }}>
            {status?.error ?? status?.note ?? (canSave === false ? 'Saving into the deck needs mdeck run; copy the times instead.' : `${changeCount} slide${changeCount === 1 ? '' : 's'} change.`)}
          </span>
          <button style={{ ...S.btn, color: '#888' }} title="Go on rehearsing (Esc)" onClick={onClose}>Back</button>
          <button style={{ ...S.btn, color: '#888' }} title="End the rehearsal without saving" onClick={onDiscard}>Discard</button>
          <button style={S.btn} onClick={copy}><Icon name="copy" size={14} />Copy</button>
          <button class="rehearsal-save" style={{ ...S.btn, background: '#1c2a3a', borderColor: '#2f4a66', opacity: canSave && changeCount && !status?.busy ? 1 : 0.5 }} disabled={!canSave || !changeCount || status?.busy} onClick={save}>Save to deck</button>
        </div>
      </div>
    </div>
  )
}
