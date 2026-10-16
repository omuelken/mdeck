import { h } from 'preact'
import { useMemo } from 'preact/hooks'
import { stepOf, format, formatTick, color, axisTicks, dateTicks, linear, extent, textWidth, Legend } from 'mdeck/dataview'

// One 3px line per series in the palette's order, across the rows: at
// their numbers or dates when the label column has them, else evenly. The
// last value of each line is written at its end, with the series' name when
// there are several; highlighted rows get their values too. A missing value
// leaves a gap; a row without a number or date across is left out, and the
// line joins across it. With steps="rows" the lines draw on one row at a time.

let clips = 0

export default function Line({ data, props, width, height, font }) {
  const small = font * 0.8
  const n = data.rows.length, k = data.series.length
  const xColumn = data.columns[data.x]
  // Numbers or dates across place a row by its value; a row without one is
  // left out (mdeck check says so), never put at its row number among years.
  const positions = data.rows.map((row, i) => xColumn.type === 'text' ? i : typeof row.cells[data.x].value === 'number' ? row.cells[data.x].value : null)
  const placed = positions.filter(position => position != null)
  const clip = useMemo(() => `dataview-line-${++clips}`, [])
  const [low, high] = extent(data, { props })
  const scale = axisTicks(low, high, { zero: !!props.zero, min: props.min, max: props.max })
  const compact = Math.max(Math.abs(scale.min), Math.abs(scale.max)) >= 100000
  const fmt = (value, series = 0) => format(data, value, series, { compact })
  const legend = k > 1 ? small * 1.9 : 0
  const svgHeight = Math.max(80, height - legend)
  const lastOf = s => { for (let i = n - 1; i >= 0; i--) if (data.rows[i].values[s] != null && positions[i] != null) return i; return -1 }
  const endText = s => { const i = lastOf(s); return i < 0 ? '' : `${k > 1 && k <= 4 ? data.series[s].name + ' ' : ''}${fmt(data.rows[i].values[s], s)}` }
  const endRoom = Math.max(0, ...data.series.map((_, s) => textWidth(endText(s), small)))
  const tickText = value => formatTick(data, value, scale.step, { compact })
  const tickWidth = Math.max(...scale.ticks.map(tick => textWidth(tickText(tick), small)))
  const plot = { x0: tickWidth + 14, x1: width - endRoom - 18, y0: small * 0.8, y1: svgHeight - small * 1.9 }
  const [first, last] = [Math.min(...placed), Math.max(...placed)]
  const x = first === last ? () => (plot.x0 + plot.x1) / 2 : linear([first, last], [plot.x0, plot.x1])
  const y = linear([scale.min, scale.max], [plot.y1, plot.y0])
  const dots = props.points === 'all' || (props.points === 'auto' && n <= 16)
  // A label under every row that fits, else every second, third …
  const every = Math.max(1, Math.ceil(Math.max(...data.rows.map(row => textWidth(row.label, small))) * n / Math.max(1, plot.x1 - plot.x0) * 1.3))
  // Dates get ticks on calendar boundaries (years, quarters, months, days), as a scatter plot does.
  const dated = xColumn.type === 'date' && placed.length > 0
  const labels = dated
    ? dateTicks(first, last, { lang: data.lang }).ticks.map(tick => <text key={tick.value} x={x(tick.value)} y={plot.y1 + small * 1.35} text-anchor="middle">{tick.label}</text>)
    : data.rows.map((row, i) => i % every === 0 && positions[i] != null && <text key={row.index} x={x(positions[i])} y={plot.y1 + small * 1.35} text-anchor="middle" class={row.highlight ? 'dataview-value' : null}>{row.label}</text>)

  // End labels that would touch are left to the legend, rather than pushed
  // away from the lines they name.
  const ends = data.series.map((_, s) => lastOf(s)).map((i, s) => i < 0 ? null : y(data.rows[i].values[s]))
  const shownEnds = new Set()
  let lastY = -Infinity
  for (const s of ends.map((value, s) => s).filter(s => ends[s] != null).sort((a, b) => ends[a] - ends[b])) {
    if (ends[s] - lastY >= small * 1.15) { shownEnds.add(s); lastY = ends[s] }
  }
  const lines = data.series.map((series, s) => {
    // Only the rows that have a place; a missing value is a gap (null) between them.
    const points = data.rows.flatMap((row, i) => positions[i] == null ? [] : [row.values[s] == null ? null : [x(positions[i]), y(row.values[s]), i]])
    const stroke = color(s)
    const parts = []
    if (data.steps === 'rows') {
      // A segment appears with the row it leads to.
      points.forEach((point, j) => { const before = points[j - 1]; if (point && before) parts.push(<path key={`seg${point[2]}`} d={`M${before[0]},${before[1]}L${point[0]},${point[1]}`} {...stepOf(data, point[2], s)} class="dataview-line" stroke={stroke} />) })
    } else {
      let d = '', open = false
      for (const point of points) { if (!point) { open = false; continue } d += `${open ? 'L' : 'M'}${point[0]},${point[1]}`; open = true }
      // A wash under one line; under several they would cover each other.
      if (props.fill && k === 1) {
        const filled = points.filter(Boolean)
        if (filled.length > 1) parts.push(<path key="fill" d={`M${filled[0][0]},${y(Math.max(scale.min, Math.min(0, scale.max)))}${filled.map(p => `L${p[0]},${p[1]}`).join('')}L${filled.at(-1)[0]},${y(Math.max(scale.min, Math.min(0, scale.max)))}Z`} fill={stroke} class="dataview-fill" />)
      }
      parts.push(<path key="line" d={d} class="dataview-line" stroke={stroke} />)
    }
    const end = lastOf(s)
    const endPoint = points.find(point => point && point[2] === end)
    points.forEach(point => {
      if (!point) return
      const i = point[2], row = data.rows[i]
      if (!(dots || i === end || row.highlight)) return
      parts.push(<circle key={`dot${i}`} cx={point[0]} cy={point[1]} r={i === end || row.highlight ? 7 : 5} fill={stroke} class="dataview-dot" {...(data.steps === 'rows' ? stepOf(data, i, s) : {})} />)
      if (row.highlight && i !== end && k === 1) parts.push(<text key={`hl${i}`} class="dataview-value" x={point[0]} y={point[1] - small * 0.8} text-anchor="middle" {...(data.steps === 'rows' ? stepOf(data, i, s) : {})}>{fmt(row.values[s], s)}</text>)
    })
    if (endPoint && shownEnds.has(s)) parts.push(<text key="end" class="dataview-value" x={endPoint[0] + 14} y={endPoint[1]} dominant-baseline="middle" {...(data.steps === 'rows' ? stepOf(data, end, s) : {})}>{endText(s)}</text>)
    return <g key={series.name} {...(data.steps === 'series' ? stepOf(data, 0, s) : {})}>{parts}</g>
  })

  return <div class="dataview-chart">
    <Legend data={data} marker="line" />
    <svg width={width} height={svgHeight} viewBox={`0 0 ${width} ${svgHeight}`} role="img" aria-label={data.title || undefined}>
      <g class="dataview-grid">{scale.ticks.map(tick => <g key={tick}>
        <line class={tick === 0 ? 'dataview-baseline' : 'dataview-gridline'} x1={plot.x0} x2={plot.x1} y1={y(tick)} y2={y(tick)} />
        <text x={plot.x0 - 10} y={y(tick)} text-anchor="end" dominant-baseline="middle">{tickText(tick)}</text>
      </g>)}</g>
      <g class="dataview-labels">{labels}</g>
      {/* An axis that starts or ends at min or max cuts what lies beyond it. */}
      <defs><clipPath id={clip}><rect x={plot.x0 - 8} y={plot.y0 - 8} width={plot.x1 - plot.x0 + 16 + endRoom + 18} height={plot.y1 - plot.y0 + 16} /></clipPath></defs>
      <g clip-path={`url(#${clip})`}>{lines}</g>
    </svg>
  </div>
}
