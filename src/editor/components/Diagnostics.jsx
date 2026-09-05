import { h } from 'preact'

export function Diagnostics({ items, onPick }) {
  if (!items.length) return null
  return <ul class="diagnostics">
    {items.map((d, i) => <li key={i} class={d.severity === 'warning' ? 'is-warning' : ''} onClick={onPick ? () => onPick(d) : undefined} style={onPick ? { cursor: 'pointer' } : undefined}>
      <code>{d.line ? `line ${d.line}` : d.code}</code>{d.message}
    </li>)}
  </ul>
}
