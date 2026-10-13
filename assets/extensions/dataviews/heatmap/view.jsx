import { h } from 'preact'
import { useMemo } from 'preact/hooks'
import { stepOf, format, extent, textWidth } from 'mdeck/dataview'

// Rows down, value columns across; each cell's colour says how large its
// value is: one hue from the slide's background to the first accent, or for
// values either side of 0 the second accent below and the first above, with
// the background at 0. Cells sit apart by a thin gap of the background.

const GAP = 3
let keys = 0

export default function Heatmap({ data, options, width, height, font }) {
  const small = font * 0.8
  const n = data.rows.length, k = data.series.length
  const [low, high] = extent(data, { options })
  const diverging = options.scale === 'diverging' || (options.scale === 'auto' && low < 0 && high > 0)
  const reach = Math.max(Math.abs(low), Math.abs(high)) || 1
  const share = value => diverging ? Math.abs(value) / reach : high === low ? 1 : (value - low) / (high - low)
  const fill = value => {
    if (value == null) return 'transparent'
    const strength = Math.round(12 + 88 * Math.max(0, Math.min(1, share(value))))
    const hue = diverging && value < 0 ? 'var(--dataview-2)' : 'var(--dataview-1)'
    return `color-mix(in oklab, ${hue} ${strength}%, var(--bg))`
  }
  const strong = value => value != null && share(value) > 0.55
  const left = Math.min(width * 0.3, Math.max(0, ...data.rows.map(row => textWidth(row.label, small))) + 16)
  const top = small * 1.8
  const keyHeight = small * 2.4
  const cellW = (width - left) / Math.max(1, k)
  const cellH = Math.min(96, (height - top - keyHeight) / Math.max(1, n))
  const gridBottom = top + cellH * n
  const fmt = (value, s) => format(data, value, s)
  const keyStops = diverging ? [-reach, 0, reach] : [low, high]
  const gradient = useMemo(() => `dataview-heat-${++keys}`, [])

  return <svg width={width} height={Math.min(height, gridBottom + keyHeight)} viewBox={`0 0 ${width} ${Math.min(height, gridBottom + keyHeight)}`} role="img" aria-label={data.title || undefined}>
    {data.series.map((series, s) => <text key={series.name} x={left + cellW * (s + 0.5)} y={top - small * 0.6} text-anchor="middle" class="dataview-value">{textWidth(series.name, small) > cellW ? series.name.slice(0, Math.max(1, Math.floor(cellW / (small * 0.56)) - 1)) + '…' : series.name}</text>)}
    {data.rows.map((row, i) => <g key={row.index}>
      <text x={left - 12} y={top + cellH * (i + 0.5)} text-anchor="end" dominant-baseline="middle" class={row.highlight ? 'dataview-value' : null}>{row.label}</text>
      {row.values.map((value, s) => <g key={s} {...stepOf(data, i, s)}>
        <rect x={left + cellW * s + GAP / 2} y={top + cellH * i + GAP / 2} width={cellW - GAP} height={cellH - GAP} rx="4" fill={fill(value)} class={row.highlight ? 'dataview-cell is-highlight' : 'dataview-cell'} />
        {options.values && value != null && cellH >= small * 1.2 && <text x={left + cellW * (s + 0.5)} y={top + cellH * (i + 0.5)} text-anchor="middle" dominant-baseline="middle" class={strong(value) ? 'dataview-cell-text is-strong' : 'dataview-cell-text'}>{fmt(value, s)}</text>}
      </g>)}
    </g>)}
    <g class="dataview-key" transform={`translate(${left}, ${gridBottom + small * 0.9})`}>
      <defs><linearGradient id={gradient}>{keyStops.map((value, i) => <stop key={i} offset={`${(i / (keyStops.length - 1)) * 100}%`} stop-color={fill(value)} />)}</linearGradient></defs>
      <text x={0} y={small * 0.55} dominant-baseline="middle">{fmt(keyStops[0], 0)}</text>
      <rect x={textWidth(fmt(keyStops[0], 0), small) + 10} y={0} width={Math.min(240, width / 4)} height={small * 1.1} rx="3" fill={`url(#${gradient})`} />
      <text x={textWidth(fmt(keyStops[0], 0), small) + 20 + Math.min(240, width / 4)} y={small * 0.55} dominant-baseline="middle">{fmt(keyStops.at(-1), 0)}</text>
    </g>
  </svg>
}
