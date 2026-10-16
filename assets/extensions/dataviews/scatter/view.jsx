import { h } from 'preact'
import { stepOf, format, formatTick, color, markColor, niceTicks, dateTicks, linear, extent, textWidth, Legend } from 'mdeck/dataview'

// Points with a ring in the slide's colour, so overlapping ones stay apart.
// `x` is the column across; every value column goes up, in its colour.
// `labels` names a column to name the points by: every point of a small
// set, else the highlighted ones (highlight="…" matches that name too).

export default function Scatter({ data, props, width, height, font }) {
  const small = font * 0.8
  const k = data.series.length
  const labelColumn = props.labels ? data.columns.findIndex(column => column.name.toLowerCase() === props.labels.toLowerCase()) : -1
  const nameOf = row => labelColumn >= 0 ? row.cells[labelColumn].text : ''
  const named = row => labelColumn >= 0 && (data.rows.length <= 12 || row.highlight)
  const xs = data.rows.map(row => row.cells[data.x].value)
  const xColumn = data.columns[data.x]
  const [xLow, xHigh] = [Math.min(...xs.filter(v => v != null)), Math.max(...xs.filter(v => v != null))]
  // Dates get ticks on calendar boundaries (years, quarters, months, days).
  const xScale = xColumn.type === 'date' ? dateTicks(xLow, xHigh, { lang: data.lang }) : niceTicks(xLow, xHigh, { zero: !!props.zero })
  const xTicks = xColumn.type === 'date' ? xScale.ticks : xScale.ticks.map(value => ({ value, label: formatTick({ ...data, series: [{ column: data.x }] }, value, xScale.step) }))
  const [low, high] = extent(data)
  const yScale = niceTicks(low, high, { zero: !!props.zero })
  const fmtY = value => formatTick(data, value, yScale.step)
  const legend = k > 1 ? small * 1.9 : 0
  const svgHeight = Math.max(80, height - legend)
  const tickWidth = Math.max(...yScale.ticks.map(tick => textWidth(fmtY(tick), small)))
  const plot = { x0: tickWidth + 14, x1: width - 20, y0: k === 1 ? small * 2 : small, y1: svgHeight - small * 3.4 }
  const x = linear([xScale.min, xScale.max], [plot.x0, plot.x1])
  const y = linear([yScale.min, yScale.max], [plot.y1, plot.y0])

  return <div class="dataview-chart">
    <Legend data={data} marker="dot" />
    <svg width={width} height={svgHeight} viewBox={`0 0 ${width} ${svgHeight}`} role="img" aria-label={data.title || undefined}>
      <g class="dataview-grid">
        {yScale.ticks.map(tick => <g key={`y${tick}`}><line class="dataview-gridline" x1={plot.x0} x2={plot.x1} y1={y(tick)} y2={y(tick)} /><text x={plot.x0 - 10} y={y(tick)} text-anchor="end" dominant-baseline="middle">{fmtY(tick)}</text></g>)}
        {xTicks.map(tick => <g key={`x${tick.value}`}><line class="dataview-gridline" x1={x(tick.value)} x2={x(tick.value)} y1={plot.y0} y2={plot.y1} /><text x={x(tick.value)} y={plot.y1 + small * 1.35} text-anchor="middle">{tick.label}</text></g>)}
        <text x={(plot.x0 + plot.x1) / 2} y={plot.y1 + small * 2.9} text-anchor="middle" class="dataview-value">{xColumn.name}</text>
        {k === 1 && <text x={plot.x0 - tickWidth - 14} y={small * 0.8} class="dataview-value">{data.series[0].name}{data.unit ? ` (${data.unit})` : ''}</text>}
      </g>
      {data.series.map((series, s) => <g key={series.name} {...(data.steps === 'series' ? stepOf(data, 0, s) : {})}>
        {data.rows.map((row, i) => row.values[s] == null || xs[i] == null ? null : <g key={row.index} {...(data.steps === 'rows' ? stepOf(data, i, s) : {})}>
          <circle cx={x(xs[i])} cy={y(row.values[s])} r={row.highlight ? 11 : 8} fill={markColor(data, row, s)} class="dataview-dot" />
          {named(row) && <text class="dataview-value" x={x(xs[i]) + 14} y={y(row.values[s])} dominant-baseline="middle">{nameOf(row)}</text>}
        </g>)}
      </g>)}
    </svg>
  </div>
}
