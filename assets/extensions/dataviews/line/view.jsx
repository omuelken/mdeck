import { h } from 'preact'
import { stepOf, format, formatTick, color, niceTicks, linear, extent, textWidth, Legend } from 'mdeck/dataview'

// One 3px line per series in the palette's order, across the rows: at
// their numbers or dates when the label column has them, else evenly. The
// last value of each line is written at its end, with the series' name when
// there are several; highlighted rows get their values too. A missing value
// leaves a gap. With steps="rows" the lines draw on one row at a time.

export default function Line({ data, options, width, height, font }) {
  const small = font * 0.8
  const n = data.rows.length, k = data.series.length
  const xColumn = data.columns[data.x]
  const positions = data.rows.map((row, i) => xColumn.type !== 'text' && typeof row.cells[data.x].value === 'number' ? row.cells[data.x].value : i)
  const [low, high] = extent(data, { options })
  const scale = niceTicks(low, high, { zero: !!options.zero || Number.isFinite(options.min) })
  const compact = Math.max(Math.abs(scale.min), Math.abs(scale.max)) >= 100000
  const fmt = (value, series = 0) => format(data, value, series, { compact })
  const legend = k > 1 ? small * 1.9 : 0
  const svgHeight = Math.max(80, height - legend)
  const lastOf = s => { for (let i = n - 1; i >= 0; i--) if (data.rows[i].values[s] != null) return i; return -1 }
  const endText = s => { const i = lastOf(s); return i < 0 ? '' : `${k > 1 && k <= 4 ? data.series[s].name + ' ' : ''}${fmt(data.rows[i].values[s], s)}` }
  const endRoom = Math.max(0, ...data.series.map((_, s) => textWidth(endText(s), small)))
  const tickText = value => formatTick(data, value, scale.step, { compact })
  const tickWidth = Math.max(...scale.ticks.map(tick => textWidth(tickText(tick), small)))
  const plot = { x0: tickWidth + 14, x1: width - endRoom - 18, y0: small * 0.8, y1: svgHeight - small * 1.9 }
  const [first, last] = [Math.min(...positions), Math.max(...positions)]
  const x = first === last ? () => (plot.x0 + plot.x1) / 2 : linear([first, last], [plot.x0, plot.x1])
  const y = linear([scale.min, scale.max], [plot.y1, plot.y0])
  const dots = options.points === 'all' || (options.points === 'auto' && n <= 16)
  // A label under every row that fits, else every second, third …
  const every = Math.max(1, Math.ceil(Math.max(...data.rows.map(row => textWidth(row.label, small))) * n / Math.max(1, plot.x1 - plot.x0) * 1.3))

  // End labels that would touch are left to the legend, rather than pushed
  // away from the lines they name.
  const ends = data.series.map((_, s) => lastOf(s)).map((i, s) => i < 0 ? null : y(data.rows[i].values[s]))
  const shownEnds = new Set()
  let lastY = -Infinity
  for (const s of ends.map((value, s) => s).filter(s => ends[s] != null).sort((a, b) => ends[a] - ends[b])) {
    if (ends[s] - lastY >= small * 1.15) { shownEnds.add(s); lastY = ends[s] }
  }
  const lines = data.series.map((series, s) => {
    const points = data.rows.map((row, i) => row.values[s] == null ? null : [x(positions[i]), y(row.values[s]), i])
    const stroke = color(s)
    const parts = []
    if (data.steps === 'rows') {
      // A segment appears with the row it leads to.
      points.forEach((point, i) => { const before = points[i - 1]; if (point && before) parts.push(<path key={`seg${i}`} d={`M${before[0]},${before[1]}L${point[0]},${point[1]}`} {...stepOf(data, i, s)} class="dataview-line" stroke={stroke} />) })
    } else {
      let d = '', open = false
      for (const point of points) { if (!point) { open = false; continue } d += `${open ? 'L' : 'M'}${point[0]},${point[1]}`; open = true }
      // A wash under one line; under several they would cover each other.
      if (options.fill && k === 1) {
        const filled = points.filter(Boolean)
        if (filled.length > 1) parts.push(<path key="fill" d={`M${filled[0][0]},${y(Math.max(scale.min, Math.min(0, scale.max)))}${filled.map(p => `L${p[0]},${p[1]}`).join('')}L${filled.at(-1)[0]},${y(Math.max(scale.min, Math.min(0, scale.max)))}Z`} fill={stroke} class="dataview-fill" />)
      }
      parts.push(<path key="line" d={d} class="dataview-line" stroke={stroke} />)
    }
    const end = lastOf(s)
    points.forEach((point, i) => {
      if (!point) return
      const row = data.rows[i]
      if (!(dots || i === end || row.highlight)) return
      parts.push(<circle key={`dot${i}`} cx={point[0]} cy={point[1]} r={i === end || row.highlight ? 7 : 5} fill={stroke} class="dataview-dot" {...(data.steps === 'rows' ? stepOf(data, i, s) : {})} />)
      if (row.highlight && i !== end && k === 1) parts.push(<text key={`hl${i}`} class="dataview-value" x={point[0]} y={point[1] - small * 0.8} text-anchor="middle" {...(data.steps === 'rows' ? stepOf(data, i, s) : {})}>{fmt(row.values[s], s)}</text>)
    })
    if (end >= 0 && shownEnds.has(s)) parts.push(<text key="end" class="dataview-value" x={points[end][0] + 14} y={points[end][1]} dominant-baseline="middle" {...(data.steps === 'rows' ? stepOf(data, end, s) : {})}>{endText(s)}</text>)
    return <g key={series.name} {...(data.steps === 'series' ? stepOf(data, 0, s) : {})}>{parts}</g>
  })

  return <div class="dataview-chart">
    <Legend data={data} marker="line" />
    <svg width={width} height={svgHeight} viewBox={`0 0 ${width} ${svgHeight}`} role="img" aria-label={data.title || undefined}>
      <g class="dataview-grid">{scale.ticks.map(tick => <g key={tick}>
        <line class={tick === 0 ? 'dataview-baseline' : 'dataview-gridline'} x1={plot.x0} x2={plot.x1} y1={y(tick)} y2={y(tick)} />
        <text x={plot.x0 - 10} y={y(tick)} text-anchor="end" dominant-baseline="middle">{tickText(tick)}</text>
      </g>)}</g>
      <g class="dataview-labels">{data.rows.map((row, i) => i % every === 0 && <text key={row.index} x={x(positions[i])} y={plot.y1 + small * 1.35} text-anchor="middle" class={row.highlight ? 'dataview-value' : null}>{row.label}</text>)}</g>
      {lines}
    </svg>
  </div>
}
