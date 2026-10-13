// `mdeck/dataview`: what a dataview may use from mdeck. A dataview is a
// folder with an extension.toml (kind = "dataview") and a view.jsx whose
// default export draws the data of a <data> tag:
//
//   export default function View({ data, props, width, height }) { … }
//
//   data     the dataset (src/core/dataset.js): columns, the label column x,
//            the value series, the rows with their values, title, unit,
//            steps, and lang
//   props    the tag's other attributes, typed by the manifest's [properties]
//   width    the room it has, in slide pixels; height its height
//   font     the text size there, in slide pixels (labels are 0.8 of it)
//
// It draws with the palette (color()), formats numbers as the deck's
// language writes them (format()), and builds up with stepOf(). The data
// tag gives it a title, a table for screen readers, and the room.
import { h } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { formatValue } from '../core/dataset.js'
// mdeck's own words in the deck's language: t('data.more', { n: 4 }).
export { t } from '../core/labels.js'

/** The colour of series `index` (from 0): the palette's accents, then mixes of them. */
export const color = index => `var(--dataview-${Math.min(index, 5) + 1})`

/** A number of the dataset's series `series` (or column) as the deck writes it. */
export function format(data, value, series = 0, { compact = false } = {}) {
  const column = data.columns[data.series[series]?.column] ?? {}
  return formatValue(value, column, data.lang, { compact })
}

/**
 * A tick of an axis whose ticks are `step` apart, with as many decimals as
 * the step needs (0, 0.5, 1 … and 0, 20, 40 …), as the deck's language writes it.
 */
export function formatTick(data, value, step, { compact = false } = {}) {
  // As many decimals as the step has: 2.5 has one, 20 none.
  const decimals = (String(Number(Number(step).toPrecision(12))).split('.')[1] ?? '').length
  const column = data.columns[data.series[0]?.column] ?? {}
  return formatValue(value, { ...column, decimals }, data.lang, { compact })
}

/** Attributes that make a part appear with its row or series, when the data builds up (steps="rows|series"). */
export function stepOf(data, row, series = 0) {
  if (data.steps === 'rows') return { 'data-step': String(row + 1) }
  if (data.steps === 'series') return { 'data-step': String(series + 1) }
  return {}
}

/** The step of the axes and gridlines: always there. */
export const always = {}

/**
 * Round numbers for an axis from `min` to `max`: { min, max, ticks }, about
 * `count` of them. A range that starts above 0 still starts at 0 when `zero`.
 */
export function niceTicks(min, max, { count = 5, zero = true } = {}) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1, ticks: [0, 1] }
  if (zero) { min = Math.min(0, min); max = Math.max(0, max) }
  if (min === max) { max = min + (Math.abs(min) || 1); if (!zero) min -= Math.abs(min) * 0.1 || 1 }
  const raw = (max - min) / Math.max(1, count)
  const power = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map(m => m * power).find(s => s >= raw) ?? 10 * power
  const low = Math.floor(min / step + 1e-9) * step
  const high = Math.ceil(max / step - 1e-9) * step
  const ticks = []
  for (let value = low; value <= high + step / 2; value += step) ticks.push(Number(value.toPrecision(12)))
  return { min: low, max: high, ticks, step }
}

/** A linear scale from [d0, d1] onto [r0, r1]. */
export function linear([d0, d1], [r0, r1]) {
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0)
  return value => r0 + (value - d0) * k
}

/** `count` bands across [r0, r1]: { start(i), center(i), size }, with `padding` (a share) between them. */
export function bands(count, [r0, r1], { padding = 0.3 } = {}) {
  const slot = (r1 - r0) / Math.max(1, count)
  const size = slot * (1 - padding)
  return { start: i => r0 + slot * i + (slot - size) / 2, center: i => r0 + slot * (i + 0.5), size, slot }
}

/** About how wide `text` is at `size` pixels: enough to leave room for labels. */
export const textWidth = (text, size) => String(text ?? '').length * size * 0.56

/**
 * The size of `ref`'s element in slide pixels, following it as it changes,
 * and its font size: { width, height, font }.
 */
export function useBox(ref) {
  const [box, setBox] = useState({ width: 0, height: 0, font: 26 })
  useEffect(() => {
    const element = ref.current
    if (!element) return
    // offsetWidth is before the stage's scaling: slide pixels.
    const measure = () => {
      const next = { width: element.offsetWidth, height: element.offsetHeight, font: parseFloat(getComputedStyle(element).fontSize) || 26 }
      setBox(old => (old.width === next.width && old.height === next.height && old.font === next.font) ? old : next)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return box
}

/**
 * A legend for two or more series: a mark of each colour beside its name, in
 * text colours. It is there from the start, also while the series build up.
 */
export function Legend({ data, marker = 'square' }) {
  if (data.series.length < 2) return null
  // Not a <ul>: themes give a slide's lists their own markers.
  return h('div', { class: 'dataview-legend', role: 'list' }, data.series.map((series, index) =>
    h('span', { key: series.name, role: 'listitem' },
      h('span', { class: `dataview-key dataview-key--${marker}`, style: { background: color(index) }, 'aria-hidden': 'true' }),
      series.name)))
}

/** The colour of a mark: its series' colour, faded when other rows are highlighted. */
export function markColor(data, row, series = 0) {
  const base = color(series)
  return data.rows.some(item => item.highlight) && !row.highlight ? `color-mix(in oklab, ${base} 45%, var(--bg))` : base
}

/**
 * A bar from `base` to `end` along its value axis, `thickness` wide at
 * `across`, with the data end rounded: an SVG path. `vertical` bars grow
 * up (or down for negative values); others grow right (or left).
 */
export function barPath({ base, end, across, thickness, vertical = true, radius = 4 }) {
  const length = Math.abs(end - base)
  const r = Math.min(radius, thickness / 2, length)
  const sign = end < base ? -1 : 1
  if (vertical) {
    // In SVG, up is smaller y: `end` < `base` is a bar going up.
    const [x0, x1] = [across, across + thickness]
    return `M${x0},${base}V${end - sign * r}Q${x0},${end} ${x0 + r},${end}H${x1 - r}Q${x1},${end} ${x1},${end - sign * r}V${base}Z`
  }
  const [y0, y1] = [across, across + thickness]
  return `M${base},${y0}H${end - sign * r}Q${end},${y0} ${end},${y0 + r}V${y1 - r}Q${end},${y1} ${end - sign * r},${y1}H${base}Z`
}

/** The lowest and highest value of the data's series (or of `series` alone), and the `min`/`max` properties when set. */
export function extent(data, { props = {}, series = null, stacked = false } = {}) {
  let low = Infinity, high = -Infinity
  for (const row of data.rows) {
    const values = series == null ? row.values : [row.values[series]]
    if (stacked) {
      const up = values.filter(value => value > 0).reduce((sum, value) => sum + value, 0)
      const down = values.filter(value => value < 0).reduce((sum, value) => sum + value, 0)
      low = Math.min(low, down); high = Math.max(high, up)
    } else for (const value of values) if (value != null) { low = Math.min(low, value); high = Math.max(high, value) }
  }
  if (!Number.isFinite(low)) { low = 0; high = 1 }
  if (Number.isFinite(props.min)) low = props.min
  if (Number.isFinite(props.max)) high = props.max
  return [low, high]
}
