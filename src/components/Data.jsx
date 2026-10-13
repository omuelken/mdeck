import { h } from 'preact'
import { useMemo, useRef } from 'preact/hooks'
import { dataviews } from 'virtual:mdeck-extensions'
import deckData from 'virtual:deck-data'
import { buildDataset, unmetNeeds } from '../core/dataset.js'
import { dataviewOptions } from '../core/dataviewOptions.js'
import { deckLanguage } from '../core/labels.js'
import { useBox, format } from '../dataviews/api.js'
import './dataview.css'

// <data show="bar" title="Yield per hectare">
// year, wheat, barley
// 2023, 6.4, 6.2
// </data>
//
// A table of data, between the tags as CSV or from a file (src="yields.csv"),
// shown by a dataview: a table unless `show` names another, such as bar or
// line. Dataviews are extensions (kind = "dataview"): built in, installed or
// beside the deck. The tag reads the attributes every dataview shares
// (src/core/dataset.js); the others are the dataview's properties.

/** The text of a data file the deck names, as the build bundled it. */
export function dataFile(src) {
  const ref = String(src ?? '').trim()
  return deckData[ref] ?? deckData[ref.replace(/^\.\//, '')] ?? deckData[`./${ref}`] ?? null
}

function Problem({ title, messages }) {
  return <div class="dataview-problem" role="alert"><strong>{title}</strong><ul>{messages.map(message => <li key={message}>{message}</li>)}</ul></div>
}

// The data for screen readers, under a chart: the label column and the values.
function ScreenReaderTable({ data }) {
  // In a box of its own: a table cannot be made smaller than its rows.
  return <div class="dataview-sr"><table>
    {data.title && <caption>{data.title}</caption>}
    <thead><tr><th scope="col">{data.columns[data.x]?.name}</th>{data.series.map(series => <th scope="col" key={series.name}>{series.name}</th>)}</tr></thead>
    <tbody>{data.rows.map(row => <tr key={row.index}><th scope="row">{row.label}</th>{row.values.map((value, i) => <td key={i}>{format(data, value, i)}{data.unit ? ` ${data.unit}` : ''}</td>)}</tr>)}</tbody>
  </table></div>
}

export default function Data(props) {
  const { src, show = 'table', caption, height, children } = props
  const ref = useRef(null)
  const box = useBox(ref)
  const view = dataviews[show]
  const csv = props['data-csv'] ?? (src ? dataFile(src) : children)
  const lang = deckLanguage()
  const prepared = useMemo(() => {
    if (!view) return { fatal: { title: `No dataview "${show}"`, messages: [`Available: ${Object.keys(dataviews).join(', ')}`] } }
    if (csv == null) return { fatal: { title: `No data in ${src}`, messages: ['The file is missing, or was not there when the deck was built. Write its path from the deck\'s folder, such as src="data/yields.csv".'] } }
    const data = buildDataset(csv, props, { lang })
    const { options, problems } = dataviewOptions(view.manifest, props)
    const errors = [...data.problems, ...problems].filter(problem => problem.severity === 'error').map(problem => problem.message)
    errors.push(...unmetNeeds(data, view.manifest.needs, view.manifest.title))
    if (data.steps && !view.manifest.steps.includes(data.steps)) errors.push(`${view.manifest.title} builds up by ${view.manifest.steps.join(' or ') || 'nothing'}, not by ${data.steps}`)
    return errors.length ? { fatal: { title: `This ${view.manifest.title.toLowerCase()} cannot show the data`, messages: errors } } : { data, options }
  }, [view, csv, lang, JSON.stringify(props)])

  if (prepared.fatal) return <figure class="dataview dataview--problem"><Problem {...prepared.fatal} /></figure>
  const { data, options } = prepared
  const fixed = view.manifest.size !== 'content'
  const style = height && Number.isFinite(Number(height)) ? { '--dataview-height': `${Number(height)}px` } : undefined
  return <figure class={`dataview dataview--${show}`} style={style} aria-label={data.title || undefined}>
    {data.title && <figcaption class="dataview-title">{data.title}</figcaption>}
    <div ref={ref} class={`dataview-body${fixed ? ' dataview-body--fixed' : ''}`}>
      {(!fixed || box.width > 0) && h(view.render, { data, props: options, width: box.width, height: box.height, font: box.font })}
    </div>
    {show !== 'table' && <ScreenReaderTable data={data} />}
    {caption && <p class="dataview-caption">{caption}</p>}
  </figure>
}
