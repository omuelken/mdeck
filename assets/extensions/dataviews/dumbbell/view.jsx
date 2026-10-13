import { h } from 'preact'
import { stepOf, format, formatTick, color, niceTicks, linear, extent, textWidth, Legend } from 'mdeck/dataview'

// One row per line: a dot for each of the two values, in the first and
// second colour, joined by a thick line in the grid's colour, so the gap
// between them is what one sees. The values sit outside the dots.

export default function Dumbbell({ data, props, width, height, font }) {
  const small = font * 0.8
  const n = data.rows.length
  const [low, high] = extent(data)
  const scale = niceTicks(low, high, { zero: !!props.zero })
  const fmt = (value, s = 0) => format(data, value, s)
  const legend = small * 1.9
  const svgHeight = Math.max(80, height - legend)
  const left = Math.min(width * 0.32, Math.max(0, ...data.rows.map(row => textWidth(row.label, small))) + 18)
  const room = props.values ? Math.max(0, ...data.rows.flatMap(row => row.values.map((v, s) => textWidth(fmt(v, s), small)))) + 16 : 12
  const plot = { x0: left + room, x1: width - room, y0: 4, y1: svgHeight - small * 1.8 }
  const x = linear([scale.min, scale.max], [plot.x0, plot.x1])
  const slot = (plot.y1 - plot.y0) / Math.max(1, n)
  const yOf = i => plot.y0 + slot * (i + 0.5)
  const r = Math.max(6, Math.min(11, slot / 4))

  return <div class="dataview-chart">
    <Legend data={data} marker="dot" />
    <svg width={width} height={svgHeight} viewBox={`0 0 ${width} ${svgHeight}`} role="img" aria-label={data.title || undefined}>
      <g class="dataview-grid">{scale.ticks.map(tick => <g key={tick}>
        <line class="dataview-gridline" x1={x(tick)} x2={x(tick)} y1={plot.y0} y2={plot.y1} />
        <text x={x(tick)} y={plot.y1 + small * 1.3} text-anchor="middle">{formatTick(data, tick, scale.step)}</text>
      </g>)}</g>
      {data.rows.map((row, i) => {
        const [a, b] = row.values
        const order = a != null && b != null && a > b ? [1, 0] : [0, 1]
        return <g key={row.index} {...stepOf(data, i)}>
          <text x={left - 12} y={yOf(i)} text-anchor="end" dominant-baseline="middle" class={row.highlight ? 'dataview-value' : null}>{row.label}</text>
          {a != null && b != null && <line x1={x(a)} x2={x(b)} y1={yOf(i)} y2={yOf(i)} class="dataview-bar" />}
          {row.values.map((value, s) => value == null ? null : <g key={s}>
            <circle cx={x(value)} cy={yOf(i)} r={r} fill={color(s)} class="dataview-dot" />
            {props.values && <text class="dataview-value" x={x(value) + (s === order[0] ? -(r + 8) : r + 8)} y={yOf(i)} text-anchor={s === order[0] ? 'end' : 'start'} dominant-baseline="middle">{fmt(value, s)}</text>}
          </g>)}
        </g>
      })}
    </svg>
  </div>
}
