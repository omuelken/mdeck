import { h } from 'preact'
import { stepOf, format, formatTick, color, markColor, niceTicks, linear, bands, barPath, extent, textWidth, Legend } from 'mdeck/dataview'

// Bars grow from one baseline at 0, with the data end rounded. One series
// takes the first colour; several sit side by side (or stacked) in the
// palette's order, with a legend. Values are labelled sparingly: every bar
// of a short single series, else the highlighted ones.

const GAP = 4
const MAX_THICKNESS = 120

const fit = (text, room, size) => {
  if (textWidth(text, size) <= room) return text
  const chars = Math.max(1, Math.floor(room / (size * 0.56)) - 1)
  return text.slice(0, chars) + '…'
}

export default function Bar({ data, props, width, height, font }) {
  const small = font * 0.8
  const n = data.rows.length, k = data.series.length
  const stacked = props.stacked && k > 1
  const [low, high] = extent(data, { props, stacked })
  const scale = niceTicks(low, high)
  const compact = Math.max(Math.abs(scale.min), Math.abs(scale.max)) >= 100000
  const fmt = (value, series = 0) => format(data, value, series, { compact })
  const valuesShown = props.values === 'all' || (props.values === 'auto' && k === 1 && n <= 12)
  const showValue = row => valuesShown || (props.values !== 'none' && row.highlight)
  const longest = Math.max(0, ...data.rows.map(row => textWidth(row.label, small)))
  const tick = value => formatTick(data, value, scale.step, { compact })
  const tickWidth = Math.max(...scale.ticks.map(value => textWidth(tick(value), small)))
  const horizontal = props.orientation === 'horizontal' || (props.orientation === 'auto' && longest > ((width - tickWidth - 20) / Math.max(1, n)) * 0.92)
  const legend = k > 1 ? small * 1.9 : 0
  const svgHeight = Math.max(80, height - legend)
  const valueRoom = Math.max(0, ...data.rows.filter(showValue).flatMap(row => row.values.map((value, s) => textWidth(fmt(value, s), small))))

  const plot = horizontal
    ? { x0: Math.min(longest, width * 0.38) + 16, x1: width - (valueRoom ? valueRoom + 14 : 12), y0: 4, y1: svgHeight - small * 1.8 }
    : { x0: tickWidth + 14, x1: width - 6, y0: valueRoom ? small * 1.7 : small * 0.7, y1: svgHeight - small * 1.9 }
  const value = horizontal ? linear([scale.min, scale.max], [plot.x0, plot.x1]) : linear([scale.min, scale.max], [plot.y1, plot.y0])
  const slots = horizontal ? bands(n, [plot.y0, plot.y1], { padding: k > 1 && !stacked ? 0.28 : 0.38 }) : bands(n, [plot.x0, plot.x1], { padding: k > 1 && !stacked ? 0.25 : 0.35 })
  const perGroup = stacked ? 1 : k
  const thickness = Math.max(2, Math.min(MAX_THICKNESS, (slots.size - GAP * (perGroup - 1)) / perGroup))
  const groupSize = thickness * perGroup + GAP * (perGroup - 1)
  const zero = value(Math.min(Math.max(0, scale.min), scale.max))

  const grid = scale.ticks.map(t => horizontal
    ? <g key={t}><line class="dataview-gridline" x1={value(t)} x2={value(t)} y1={plot.y0} y2={plot.y1} /><text x={value(t)} y={plot.y1 + small * 1.3} text-anchor="middle">{tick(t)}</text></g>
    : <g key={t}><line class="dataview-gridline" x1={plot.x0} x2={plot.x1} y1={value(t)} y2={value(t)} /><text x={plot.x0 - 10} y={value(t)} text-anchor="end" dominant-baseline="middle">{tick(t)}</text></g>)

  const bars = data.rows.flatMap((row, i) => {
    let up = 0, down = 0
    const groupStart = slots.center(i) - groupSize / 2
    return row.values.map((v, s) => {
      if (v == null) return null
      let from = 0
      if (stacked) { from = v >= 0 ? up : down; if (v >= 0) up += v; else down += v }
      const across = stacked ? groupStart : groupStart + s * (thickness + GAP)
      const end = value(from + v), base = value(from)
      const label = showValue(row) && (!stacked || s === k - 1)
      const shown = stacked ? fmt(up + down) : fmt(v, s)
      const tip = stacked ? value(v >= 0 ? up : down) : end
      return <g key={`${i}:${s}`} {...stepOf(data, i, s)}>
        <path d={barPath({ base, end, across, thickness, vertical: !horizontal, radius: Math.min(8, thickness / 4) })} fill={markColor(data, row, s)} />
        {label && (horizontal
          ? <text class="dataview-value" x={tip + (v < 0 ? -8 : 8)} y={across + thickness / 2} text-anchor={v < 0 ? 'end' : 'start'} dominant-baseline="middle">{shown}</text>
          : <text class="dataview-value" x={stacked ? slots.center(i) : across + thickness / 2} y={tip + (v < 0 ? small * 1.1 : -small * 0.45)} text-anchor="middle">{shown}</text>)}
      </g>
    })
  })

  const labels = data.rows.map((row, i) => horizontal
    ? <text key={row.index} x={plot.x0 - 12} y={slots.center(i)} text-anchor="end" dominant-baseline="middle" class={row.highlight ? 'dataview-value' : null}>{fit(row.label, plot.x0 - 16, small)}</text>
    : <text key={row.index} x={slots.center(i)} y={plot.y1 + small * 1.35} text-anchor="middle" class={row.highlight ? 'dataview-value' : null}>{fit(row.label, slots.slot, small)}</text>)

  return <div class="dataview-chart">
    <Legend data={data} />
    <svg width={width} height={svgHeight} viewBox={`0 0 ${width} ${svgHeight}`} role="img" aria-label={data.title || undefined}>
      <g class="dataview-grid">{grid}</g>
      {bars}
      {horizontal
        ? <line class="dataview-baseline" x1={zero} x2={zero} y1={plot.y0} y2={plot.y1} />
        : <line class="dataview-baseline" x1={plot.x0} x2={plot.x1} y1={zero} y2={zero} />}
      <g class="dataview-labels">{labels}</g>
    </svg>
  </div>
}
