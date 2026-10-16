import { h } from 'preact'
import { stepOf, format, t } from 'mdeck/dataview'

// The data as a table. Without y, every column, in the file's order; with
// y, the label column and those. Numbers sit right, under their header with
// the unit; highlighted rows stand out; rows past max-rows are counted.
export default function Table({ data, props }) {
  // Without y, text columns too: a table shows what the file holds.
  const columns = data.chosen
    ? [data.x, ...data.series.map(series => series.column)]
    : data.columns.map((column, index) => index)
  const shown = data.rows.slice(0, props['max-rows'])
  const rest = data.rows.length - shown.length
  const isNumber = column => data.columns[column].type === 'number'
  const seriesOf = column => data.series.findIndex(series => series.column === column)
  const cell = (row, column) => {
    const { text, value } = row.cells[column]
    if (!isNumber(column) || props.numbers !== 'formatted' || value == null) return text
    const series = seriesOf(column)
    return series >= 0 ? format(data, value, series) : text
  }
  return <table class="dataview-table">
    <thead><tr>{columns.map(column => <th key={column} scope="col" class={isNumber(column) ? 'is-number' : null}>
      {data.columns[column].name}{data.unit && isNumber(column) && column !== data.x ? <span class="dataview-unit"> ({data.unit})</span> : null}
    </th>)}</tr></thead>
    <tbody>
      {shown.map((row, i) => <tr key={row.index} class={row.highlight ? 'is-highlight' : null} {...stepOf(data, i)}>
        {columns.map(column => column === data.x
          ? <th key={column} scope="row" class={isNumber(column) ? 'is-number' : null}>{cell(row, column)}</th>
          : <td key={column} class={isNumber(column) ? 'is-number' : null}>{cell(row, column)}</td>)}
      </tr>)}
    </tbody>
    {rest > 0 && <tfoot><tr><td colSpan={columns.length}>{t('data.more', { n: rest })}</td></tr></tfoot>}
  </table>
}
