import { h } from 'preact'
import { stepOf } from 'mdeck/dataview'

// Each row a figure: its first value large, as the data writes it, in the text's own face and
// colour, the unit beside it, the row's label under it, and a change when
// the `change` column has one. The figure is a number to read, not a mark.

export default function Stat({ data, options }) {
  const changeColumn = options.change ? data.columns.findIndex(column => column.name.toLowerCase() === options.change.toLowerCase()) : -1
  return <div class="dataview-stats">
    {data.rows.map((row, i) => {
      const change = changeColumn >= 0 ? row.cells[changeColumn] : null
      const delta = typeof change?.value === 'number' ? change.value : null
      return <div key={row.index} class={`dataview-stat${row.highlight ? ' is-highlight' : ''}`} {...stepOf(data, i)}>
        <span class="dataview-stat-value">{(row.cells[data.series[0].column].text || '').replace(/^-/, '\u2212')}{data.unit && <span class="dataview-stat-unit">{data.unit}</span>}</span>
        <span class="dataview-stat-label">{row.label}</span>
        {change && change.text && <span class="dataview-stat-change">
          {delta != null && delta !== 0 && <span aria-hidden="true">{delta > 0 ? '▲' : '▼'} </span>}
          {delta != null && delta > 0 && !change.text.trim().startsWith('+') ? '+' : ''}{change.text}
        </span>}
      </div>
    })}
  </div>
}
