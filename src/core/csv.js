// Tables of data as people write and export them: CSV with a header row,
// separated by commas, semicolons or tabs (Excel in many countries uses
// semicolons), quoted cells that hold separators or line breaks, numbers
// with a decimal point or a decimal comma (and no thousands separators),
// percentages and dates. Plain functions, for the slides and for
// `mdeck check` alike.

const SEPARATORS = [',', ';', '\t']

// The separator of the first line, counted outside quotes; a comma when none.
function separatorOf(line) {
  let best = ',', most = 0
  for (const separator of SEPARATORS) {
    let count = 0, quoted = false
    for (const char of line) {
      if (char === '"') quoted = !quoted
      else if (char === separator && !quoted) count++
    }
    if (count > most) { best = separator; most = count }
  }
  return best
}

/**
 * CSV text as { header, rows, separator, problems }: `header` the first
 * row's names, `rows` the other rows' cells as written (trimmed), each as
 * long as the header. Blank lines are skipped; text indented as a whole
 * (inside a tag) loses its indent. `problems` are [{ row, message }], rows
 * counted from 1 for the first row after the header.
 */
export function parseCsv(text) {
  const lines = String(text ?? '').replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n')
  const indent = Math.min(...lines.filter(line => line.trim()).map(line => line.match(/^[ \t]*/)[0].length))
  const source = lines.map(line => line.slice(Number.isFinite(indent) ? indent : 0)).join('\n').trim()
  if (!source) return { header: [], rows: [], separator: ',', problems: [{ row: 0, message: 'has no data: write a header row and at least one row of values' }] }
  const separator = separatorOf(source.slice(0, source.indexOf('\n') < 0 ? undefined : source.indexOf('\n')))
  const records = []
  let record = [], cell = '', quoted = false, wasQuoted = false, i = 0
  const endCell = () => { record.push(wasQuoted ? cell : cell.trim()); cell = ''; wasQuoted = false }
  const endRecord = () => { endCell(); if (record.length > 1 || record[0] !== '') records.push(record); record = [] }
  while (i < source.length) {
    const char = source[i]
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { cell += '"'; i += 2; continue }
      if (char === '"') { quoted = false; i++; continue }
      cell += char
    } else if (char === '"' && !cell.trim()) { quoted = true; wasQuoted = true; cell = '' }
    else if (char === separator) endCell()
    else if (char === '\n') endRecord()
    else cell += char
    i++
  }
  endRecord()
  const [header = [], ...rest] = records
  const problems = []
  if (quoted) problems.push({ row: rest.length, message: 'has a quote (") that is never closed' })
  // The first column may go without a name, as the row names of a matrix often do.
  header.forEach((name, column) => { if (!name && column > 0) problems.push({ row: 0, message: `column ${column + 1} has no name in the header row` }) })
  const seen = new Set()
  for (const name of header) { if (name && seen.has(name)) problems.push({ row: 0, message: `names the column "${name}" twice` }); seen.add(name) }
  const rows = rest.map((cells, index) => {
    if (cells.length > header.length) problems.push({ row: index + 1, message: `has ${cells.length} cells, the header ${header.length}` })
    return header.map((_, column) => cells[column] ?? '')
  })
  if (!rows.length && header.length) problems.push({ row: 0, message: 'has a header row but no values' })
  return { header, rows, separator, problems }
}

const NUMBER_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i

/**
 * A cell as a number: { value, percent, decimals } or null. The decimal
 * separator is a point or a comma (7.1 or 7,1); numbers have no thousands
 * separators, so 1,234 is one point two three four.
 */
export function parseNumber(text) {
  let plain = String(text ?? '').replace(/[\s\u00a0\u202f]/g, '').replace(/[\u2212\u2013]/g, '-')
  if (!plain) return null
  const percent = plain.endsWith('%')
  if (percent) plain = plain.slice(0, -1)
  if (!plain.includes('.')) plain = plain.replace(/,(?=\d*$)/, '.')
  if (!NUMBER_RE.test(plain)) return null
  const value = Number(plain)
  if (!Number.isFinite(value)) return null
  const decimals = /\.(\d+)/.exec(plain.replace(/e.*$/i, ''))?.[1].length ?? 0
  return { value, percent, decimals }
}

const DATE_RE = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/

/** A cell as a date (2024-03 or 2024-03-15): a time in ms, or null. */
export function parseDate(text) {
  const match = DATE_RE.exec(String(text ?? '').trim())
  if (!match) return null
  const [, year, month, day = '01'] = match
  const time = Date.UTC(Number(year), Number(month) - 1, Number(day))
  return Number.isFinite(time) && Number(month) >= 1 && Number(month) <= 12 ? time : null
}

/**
 * The columns of a parsed table with their kind of values:
 * [{ name, type: 'number' | 'date' | 'text', percent, decimals }], and the
 * cells as { text, value } (value a number for numbers and dates, else the
 * text; null when empty). A column is of numbers when every filled cell is
 * one.
 */
export function typeTable({ header, rows }) {
  const columns = header.map((name, column) => {
    const filled = rows.map(row => row[column]).filter(cell => cell !== '')
    const numbers = filled.map(cell => parseNumber(cell))
    if (filled.length && numbers.every(Boolean)) {
      return { name, type: 'number', percent: numbers.every(number => number.percent), decimals: Math.min(4, Math.max(0, ...numbers.map(number => number.decimals))) }
    }
    if (filled.length && filled.every(cell => parseDate(cell) != null)) return { name, type: 'date', percent: false, decimals: 0 }
    return { name, type: 'text', percent: false, decimals: 0 }
  })
  const typed = rows.map(row => row.map((text, column) => {
    if (text === '') return { text, value: null }
    const type = columns[column].type
    if (type === 'number') return { text, value: parseNumber(text).value }
    if (type === 'date') return { text, value: parseDate(text) }
    return { text, value: text }
  }))
  return { columns, rows: typed }
}

/** The cells of a column that are not numbers, as [{ row, text }] (rows from 1), for messages. */
export function notNumbers({ rows }, column) {
  return rows.map((row, index) => ({ row: index + 1, text: row[column] })).filter(({ text }) => text !== '' && !parseNumber(text))
}
