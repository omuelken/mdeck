// The data of a <data> tag as a dataview receives it: the table typed
// (csv.js), with the attributes every dataview shares applied: which column
// labels the rows (`x`), which columns are the values (`y`), which rows and
// in what order (`rows`, `sort`), what stands out (`highlight`) and how the
// data builds up (`steps`). What is wrong is reported, not thrown: the slide
// shows it, `mdeck check` names it.
import { parseCsv, typeTable } from './csv.js'

/** Attributes the <data> tag reads itself; every other one is the dataview's option. */
export const SHARED_ATTRIBUTES = ['src', 'show', 'title', 'x', 'y', 'rows', 'sort', 'highlight', 'steps', 'unit', 'height', 'caption', 'data-csv', 'children', 'class', 'style', 'id', 'data-hotspot']
export const STEP_MODES = ['rows', 'series']

// "a, b" as ["a", "b"]; a name with a comma is written in quotes: "a, b", c
export function listOf(text) {
  const items = []
  const re = /\s*(?:"([^"]*)"|([^,]+))\s*(?:,|$)/g
  let match
  while ((match = re.exec(String(text ?? ''))) && match[0]) items.push((match[1] ?? match[2]).trim())
  return items.filter(Boolean)
}

// "1-10" or "1,3,5-7": the row numbers, from 1, in the order written, each once.
export function rowNumbers(text) {
  const numbers = []
  for (const part of String(text).split(',').map(part => part.trim()).filter(Boolean)) {
    const range = /^(\d+)\s*(?:-\s*(\d+))?$/.exec(part)
    if (!range) return null
    const [from, to] = [Number(range[1]), Number(range[2] ?? range[1])]
    if (!from || to < from) return null
    for (let n = from; n <= to; n++) if (!numbers.includes(n)) numbers.push(n)
  }
  return numbers
}

const findColumn = (columns, name) => {
  const wanted = String(name).trim().toLowerCase()
  return columns.findIndex(column => column.name.toLowerCase() === wanted)
}

/**
 * The dataset: { columns, x, series, rows, title, unit, steps, problems }.
 *   columns  [{ name, type, percent, decimals }], all of the table's
 *   x        the index of the column that labels the rows
 *   series   [{ name, column, index }], the value columns, in order
 *   rows     [{ index, label, cells, values, highlight }]: `index` the row's
 *            number in the file (from 1), `label` the x cell's text,
 *            `values` the series' numbers (null when empty or not a number)
 *   steps    'rows', 'series' or null
 *   problems [{ severity, message }]
 * `csv` is the table's text; `attrs` the tag's attributes; `lang` the
 * deck's language, for 7,1 and for showing numbers.
 */
export function buildDataset(csv, attrs = {}, { lang = null } = {}) {
  const problems = []
  const problem = (message, severity = 'error') => problems.push({ severity, message })
  const parsed = parseCsv(csv)
  for (const { row, message } of parsed.problems) problem(row ? `Row ${row} ${message}` : `The data ${message}`)
  const { columns, rows: typed } = typeTable(parsed, { lang })

  // The label column: `x`, else the first that is not numbers, else the first.
  let x = 0
  if (attrs.x != null && attrs.x !== '') {
    x = findColumn(columns, attrs.x)
    if (x < 0) { problem(`x names the column "${attrs.x}", which the data does not have. Columns: ${columns.map(column => column.name).join(', ')}`); x = 0 }
  } else {
    const label = columns.findIndex(column => column.type !== 'number')
    x = label >= 0 ? label : 0
  }

  // The value columns: `y`, else every column of numbers but x.
  let valueColumns
  if (attrs.y != null && attrs.y !== '') {
    valueColumns = []
    for (const name of listOf(attrs.y)) {
      const column = findColumn(columns, name)
      if (column < 0) problem(`y names the column "${name}", which the data does not have. Columns: ${columns.map(c => c.name).join(', ')}`)
      else valueColumns.push(column)
    }
  } else valueColumns = columns.map((column, index) => index).filter(index => index !== x && columns[index].type === 'number')
  const series = valueColumns.map((column, index) => ({ name: columns[column].name, column, index }))
  for (const { name, column } of series) {
    if (columns[column].type === 'number') continue
    const bad = typed.map((row, index) => ({ row: index + 1, text: row[column].text })).filter(cell => cell.text !== '')
    problem(`The column "${name}" should hold numbers, but row ${bad[0]?.row} has "${bad[0]?.text}"${bad.length > 1 ? ` (and ${bad.length - 1} more)` : ''}`)
  }

  let rows = typed.map((cells, i) => ({
    index: i + 1,
    label: cells[x]?.text ?? '',
    cells,
    values: series.map(({ column }) => columns[column].type === 'number' ? cells[column].value : null),
    highlight: false,
  }))

  if (attrs.sort != null && attrs.sort !== '') {
    const [, name, order] = /^(.*?)(?:\s+(asc|desc))?$/i.exec(String(attrs.sort).trim())
    const column = findColumn(columns, name)
    if (column < 0) problem(`sort names the column "${name}", which the data does not have`)
    else {
      const direction = order?.toLowerCase() === 'desc' ? -1 : 1
      const key = row => row.cells[column].value
      rows = [...rows].sort((a, b) => {
        const [p, q] = [key(a), key(b)]
        if (p == null || q == null) return p == null ? (q == null ? 0 : 1) : -1
        return (typeof p === 'number' && typeof q === 'number' ? p - q : String(p).localeCompare(String(q), lang ?? undefined, { numeric: true })) * direction
      })
    }
  }

  if (attrs.rows != null && attrs.rows !== '') {
    const numbers = rowNumbers(attrs.rows)
    if (!numbers) problem(`rows takes row numbers such as 1-10 or 1,3,5, not "${attrs.rows}"`)
    else {
      // Counted as they are shown, after sorting: rows="1-5" with a sort is the top five.
      const missing = numbers.filter(n => n > rows.length)
      if (missing.length) problem(`rows names row ${missing[0]}, but the data has ${rows.length}`, 'warning')
      rows = numbers.filter(n => n <= rows.length).map(n => rows[n - 1])
    }
  }

  if (attrs.highlight != null && attrs.highlight !== '') {
    for (const wanted of listOf(attrs.highlight)) {
      // The row's label, else any of its cells: a scatter plot's points are
      // named in another column than the numbers across.
      const same = text => text.toLowerCase() === wanted.toLowerCase()
      let found = rows.filter(row => same(row.label))
      if (!found.length) found = rows.filter(row => row.cells.some(cell => same(cell.text)))
      if (!found.length) problem(`highlight names "${wanted}", which no row is labelled`, 'warning')
      for (const row of found) row.highlight = true
    }
  }

  let steps = null
  if (attrs.steps != null && attrs.steps !== '' && attrs.steps !== 'false') {
    if (STEP_MODES.includes(attrs.steps)) steps = attrs.steps
    else problem(`steps must be ${STEP_MODES.join(' or ')}, not "${attrs.steps}"`)
  }

  return { columns, x, series, rows, title: attrs.title ?? '', unit: attrs.unit ?? '', steps, lang, problems }
}

/** What a dataview needs (`needs` in its manifest) that the dataset lacks, as messages. */
export function unmetNeeds(dataset, needs = {}, view = 'This dataview') {
  const messages = []
  const numbers = dataset.series.filter(series => dataset.columns[series.column].type === 'number').length
  if (needs.numbers && numbers < needs.numbers) messages.push(`${view} needs ${needs.numbers === 1 ? 'a column' : `${needs.numbers} columns`} of numbers${numbers ? `, the data has ${numbers}` : ''}`)
  if (needs.series && dataset.series.length > needs.series) messages.push(`${view} shows at most ${needs.series} value column${needs.series === 1 ? '' : 's'}; choose them with y="…"`)
  const x = dataset.columns[dataset.x]
  if (needs.x === 'number' && x && x.type === 'text') messages.push(`${view} needs x to name a column of numbers or dates, such as x="${dataset.columns.find(column => column.type !== 'text')?.name ?? 'year'}"; "${x.name}" holds text`)
  if (needs.rows && dataset.rows.length > needs.rows) messages.push(`${view} shows at most ${needs.rows} rows, the data has ${dataset.rows.length}; choose some with rows="1-${needs.rows}"`)
  return messages
}

const formats = new Map()
/** A number as the deck's language writes it, with the column's decimals (and %). */
export function formatValue(value, column = {}, lang = null, { compact = false } = {}) {
  if (value == null || !Number.isFinite(value)) return ''
  const key = `${lang}|${column.decimals ?? 0}|${compact}`
  if (!formats.has(key)) {
    let format
    try { format = new Intl.NumberFormat(lang ?? undefined, compact ? { notation: 'compact', maximumFractionDigits: 1 } : { minimumFractionDigits: column.decimals ?? 0, maximumFractionDigits: column.decimals ?? 0 }) } catch { format = new Intl.NumberFormat(undefined) }
    formats.set(key, format)
  }
  return formats.get(key).format(value) + (column.percent ? ' %' : '')
}
