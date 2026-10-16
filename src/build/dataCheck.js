// What `mdeck check` says about a deck's <data> tags: a data file that is
// missing, a dataview that does not exist, columns the data does not have,
// values that are not numbers, options a dataview does not take, and data a
// dataview cannot show, each at the tag's line. The slides show the same
// problems in place of the data (src/components/Data.jsx).
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { tagsIn } from '../core/tags.js'
import { dataTagsIn } from '../core/dataTag.js'
import { buildDataset, unmetNeeds } from '../core/dataset.js'
import { dataviewOptions } from '../core/dataviewOptions.js'
import { parseSlides } from '../core/parseSlides.js'
import { languageOfFile } from '../core/languages.js'

// Past this many value columns the palette's three accents run out, and
// the mixes that follow are harder to tell apart.
const MANY_SERIES = 3

export function dataDiagnostics(slidesPath, registry, source = readFileSync(slidesPath, 'utf8')) {
  const opens = tagsIn(source).filter(tag => tag.name === 'data' && !tag.closing)
  if (!opens.length) return []
  const config = parseSlides(source).deckConfig ?? {}
  const lang = typeof config.lang === 'string' ? config.lang : languageOfFile(basename(slidesPath))?.lang ?? null
  const diagnostics = []
  dataTagsIn(source).forEach(({ attrs, csv }, i) => {
    const at = opens[i]?.start
    const line = at == null ? 1 : source.slice(0, at).split('\n').length
    const add = (severity, message) => diagnostics.push({ severity, code: 'data', message, line, column: 1 })
    const show = attrs.show || 'table'
    const view = registry.dataviews?.[show]
    if (!view) { add('error', `<data show="${show}">: no dataview is named so. Available: ${Object.keys(registry.dataviews ?? {}).join(', ')}`); return }
    let text = csv
    if (attrs.src) {
      const file = resolve(dirname(resolve(slidesPath)), String(attrs.src).trim())
      if (csv != null && csv.trim()) add('warning', `<data src="${attrs.src}"> also has data between its tags; the data between the tags is shown`)
      else if (!existsSync(file)) { add('error', `Missing data file: ${attrs.src}`); return }
      else text = readFileSync(file, 'utf8')
    }
    if (text == null || !text.trim()) { add('error', '<data> has no data: write CSV between <data> and </data>, or name a file with src="…"'); return }
    const where = `<data${attrs.show ? ` show="${attrs.show}"` : ''}>`
    const data = buildDataset(text, attrs, { lang })
    for (const problem of data.problems) add(problem.severity, `${where}: ${problem.message}`)
    for (const problem of dataviewOptions(view.manifest, attrs).problems) add(problem.severity, `${where}: ${problem.message}`)
    if (data.problems.some(problem => problem.severity === 'error')) return
    for (const message of unmetNeeds(data, view.manifest.needs, view.manifest.title)) add('error', `${where}: ${message}`)
    if (data.steps && !view.manifest.steps.includes(data.steps)) add('error', `${where}: ${view.manifest.title} builds up by ${view.manifest.steps.join(' or ') || 'nothing'}, not by ${data.steps}`)
    // Bars start at 0: bars cut off below it make small differences look large.
    const { options } = dataviewOptions(view.manifest, attrs)
    if (show === 'bar' && Number.isFinite(options.min) && options.min > 0) add('warning', `${where}: bars always start at 0, so min="${attrs.min}" is ignored: bars cut off below make differences look larger than they are. To start the axis at ${attrs.min}, use show="line"`)
    // Rows a line or a scatter plot cannot place: no number or date across.
    const xColumn = data.columns[data.x]
    if (['line', 'scatter'].includes(show) && xColumn && xColumn.type !== 'text') {
      const missing = data.rows.filter(row => row.cells[data.x].value == null)
      if (missing.length) add('warning', `${where}: row ${missing[0].index}${missing.length > 1 ? ` (and ${missing.length - 1} more)` : ''} has no ${xColumn.name} and is left out`)
    }
    if (!['table', 'heatmap'].includes(show) && data.series.length > MANY_SERIES) add('warning', `${where} shows ${data.series.length} value columns; the palette has three accents, and the ones after are harder to tell apart. Show fewer with y="…", or split the data over two slides`)
  })
  return diagnostics
}
