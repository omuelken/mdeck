import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createServer as createHttpServer } from 'node:http'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { parseCsv, parseNumber, typeTable } from '../src/core/csv.js'
import { buildDataset, unmetNeeds, formatValue, listOf, rowNumbers } from '../src/core/dataset.js'
import { expandDataTags, dataTagsIn } from '../src/core/dataTag.js'
import { dataviewOptions } from '../src/core/dataviewOptions.js'
import { validateManifest, ManifestError } from '../src/extensions/manifest.js'
import { builtInRegistry, loadRegistry } from '../src/extensions/discover.js'
import { dataDiagnostics } from '../src/build/dataCheck.js'
import { dataFiles, slidesPlugin, rewriteAssetRefs, generateExtensionsModule } from '../src/build/slidesPlugin.js'
import { niceTicks, formatTick, barPath } from '../src/dataviews/api.js'

test('CSV as people export it: commas, semicolons, tabs, quotes, blank lines and an indent', () => {
  assert.deepEqual(parseCsv('a, b\n1, 2\n\n3, 4\n'), { header: ['a', 'b'], rows: [['1', '2'], ['3', '4']], separator: ',', problems: [] })
  assert.equal(parseCsv('a;b\n1,5;2').separator, ';')
  assert.equal(parseCsv('a\tb\n1\t2').separator, '\t')
  assert.deepEqual(parseCsv('name,note\n"Smith, J.","said ""hi""\nand left"').rows, [['Smith, J.', 'said "hi"\nand left']])
  assert.deepEqual(parseCsv('    x, y\n    1, 2').header, ['x', 'y'], 'text indented inside a tag loses its indent')
  assert.match(parseCsv('a,b\n1,2,3').problems[0].message, /3 cells, the header 2/)
  assert.match(parseCsv('a,a\n1,2').problems[0].message, /twice/)
  assert.deepEqual(parseCsv(',x\nrow,1').problems, [], 'the first column may go without a name')
  assert.match(parseCsv('').problems[0].message, /no data/)
})

test('numbers with a decimal point or comma, thousands, percentages and minus signs', () => {
  assert.equal(parseNumber('7.1').value, 7.1)
  assert.equal(parseNumber('1,234').value, 1234)
  assert.equal(parseNumber('7,1', { decimalComma: true }).value, 7.1)
  assert.equal(parseNumber('1.234,5', { decimalComma: true }).value, 1234.5)
  assert.equal(parseNumber("1'234.5").value, 1234.5, 'Swiss thousands')
  assert.equal(parseNumber('−3').value, -3)
  assert.deepEqual(parseNumber('12 %'), { value: 12, percent: true, decimals: 0 })
  assert.equal(parseNumber('n/a'), null)
  // A semicolon file or a German deck reads 7,1 as seven point one.
  assert.equal(typeTable(parseCsv('a;b\nx;7,1')).rows[0][1].value, 7.1)
  assert.equal(typeTable(parseCsv('a,b\nx,"7,1"'), { lang: 'de' }).rows[0][1].value, 7.1)
  assert.equal(typeTable(parseCsv('a,b\nx,"7,100"'), { lang: 'en' }).rows[0][1].value, 7100)
  const { columns } = typeTable(parseCsv('when,share,name\n2024-03,12 %,a\n2024-04,15 %,b'))
  assert.deepEqual(columns.map(column => column.type), ['date', 'number', 'text'])
  assert.equal(columns[1].percent, true)
})

test('the dataset: label and value columns, rows, sorting, highlights and steps', () => {
  const csv = 'region, wheat, barley, note\nAargau, 7.1, 5.9, a\nBern, 7.8, 6.0, b\nLuzern, 6.9, , c'
  const data = buildDataset(csv, {})
  assert.equal(data.columns[data.x].name, 'region')
  assert.deepEqual(data.series.map(series => series.name), ['wheat', 'barley'], 'every column of numbers but the label')
  assert.deepEqual(data.rows[2].values, [6.9, null], 'an empty cell is no value')
  const sorted = buildDataset(csv, { sort: 'wheat desc', rows: '1-2', highlight: 'bern', y: 'wheat', steps: 'rows' })
  assert.deepEqual(sorted.rows.map(row => row.label), ['Bern', 'Aargau'], 'rows count after sorting: the top two')
  assert.equal(sorted.rows[0].highlight, true)
  assert.equal(sorted.steps, 'rows')
  assert.deepEqual(sorted.problems, [])
  const wrong = buildDataset(csv, { x: 'canton', y: 'note, rye', steps: 'cells', highlight: 'Zug' })
  assert.deepEqual(wrong.problems.map(problem => problem.severity), ['error', 'error', 'error', 'warning', 'error'])
  assert.match(wrong.problems.map(problem => problem.message).join('\n'), /x names the column "canton"[^]*"rye"[^]*"note" should hold numbers, but row 1 has "a"[^]*Zug[^]*steps must be/)
  // A scatter plot's points are named in another column than its numbers.
  assert.equal(buildDataset('site, rain, yield\nBern, 1030, 7.8', { x: 'rain', highlight: 'Bern' }).rows[0].highlight, true)
  assert.deepEqual(listOf('a, "b, c", d'), ['a', 'b, c', 'd'])
  assert.deepEqual(rowNumbers('3, 1-2, 2'), [3, 1, 2])
  assert.equal(rowNumbers('x'), null)
})

test('what a dataview needs, and numbers in the deck\'s language', () => {
  const data = buildDataset('name, a\nx, 1\ny, 2\nz, 3', {})
  assert.deepEqual(unmetNeeds(data, { numbers: 2 }, 'Dumbbell'), ['Dumbbell needs 2 columns of numbers, the data has 1'])
  assert.match(unmetNeeds(data, { rows: 2 }, 'Stat')[0], /at most 2 rows, the data has 3; choose some with rows="1-2"/)
  assert.match(unmetNeeds(data, { x: 'number' }, 'Scatter')[0], /x to name a column of numbers or dates, such as x="a"/)
  assert.equal(formatValue(1234.5, { decimals: 1 }, 'de'), '1.234,5')
  assert.equal(formatValue(0.5, { decimals: 1, percent: true }, 'en'), '0.5 %')
  assert.equal(formatValue(2500000, {}, 'en', { compact: true }), '2.5M')
})

test('CSV between the tags moves into data-csv, so Markdown never reads it', () => {
  const markdown = '# T\n\n<data show="bar">\nyear, n\n- 1, 2\n\n# 2, 3\n</data>\n\nAfter.'
  const expanded = expandDataTags(markdown)
  assert.match(expanded, /<data show="bar" data-csv="year, n&#10;- 1, 2&#10;&#10;# 2, 3">\n<\/data>/)
  assert.equal(expandDataTags(expanded), expanded, 'a second pass leaves it as it is')
  assert.deepEqual(dataTagsIn(markdown), [{ attrs: { show: 'bar', 'data-csv': 'year, n\n- 1, 2\n\n# 2, 3' }, csv: 'year, n\n- 1, 2\n\n# 2, 3' }])
  assert.deepEqual(dataTagsIn('<data src="a.csv" />'), [{ attrs: { src: 'a.csv' }, csv: null }])
  assert.equal(expandDataTags('```\n<data>\n```'), '```\n<data>\n```', 'a tag in code is no tag')
})

test('options are typed by the dataview\'s manifest; unknown attributes are named', () => {
  const manifest = { id: 'bar', options: { stacked: { type: 'boolean', default: false }, min: { type: 'number' }, orientation: { type: 'string', enum: ['auto', 'vertical'], default: 'auto' } } }
  assert.deepEqual(dataviewOptions(manifest, { stacked: '', min: '-5', title: 'x', 'data-csv': 'a' }), { options: { stacked: true, min: -5, orientation: 'auto' }, problems: [] })
  const { options, problems } = dataviewOptions(manifest, { orientation: 'diagonal', colour: 'red', min: 'low' })
  assert.equal(options.orientation, 'auto', 'a value it cannot take leaves the default')
  assert.deepEqual(problems.map(problem => problem.severity), ['error', 'error', 'warning'])
  assert.match(problems[2].message, /no option "colour"; it takes: stacked, min, orientation/)
})

test('dataview manifests: options, needs, steps and size are checked', () => {
  const check = raw => validateManifest({ schema: 1, kind: 'dataview', id: 'x', title: 'X', ...raw }, { dir: '/x', folderName: 'x', fileExists: () => true })
  const record = check({ options: { goal: { type: 'number', default: 100 } }, needs: { numbers: 1, x: 'number' }, steps: ['rows'], size: 'content' })
  assert.deepEqual(record.manifest, { id: 'x', title: 'X', description: '', options: { goal: { type: 'number', default: 100 } }, needs: { numbers: 1, x: 'number' }, steps: ['rows'], size: 'content' })
  assert.match(record.files.view, /view\.jsx$/)
  assert.throws(() => check({ options: { title: { type: 'string' } } }), /every dataview shares/)
  assert.throws(() => check({ options: { list: { type: 'array' } } }), /written as an attribute/)
  assert.throws(() => check({ needs: { colours: 3 } }), /Unknown need/)
  assert.throws(() => check({ steps: ['cells'] }), /steps must be a list of: rows, series/)
  assert.throws(() => validateManifest({ schema: 1, kind: 'dataview', id: 'x', title: 'X' }, { dir: '/x', folderName: 'x', fileExists: () => false }), ManifestError)
})

test('the built-in dataviews validate, and the extensions module brings them along', () => {
  const registry = builtInRegistry()
  assert.deepEqual(Object.keys(registry.dataviews), ['bar', 'dumbbell', 'heatmap', 'line', 'scatter', 'stat', 'table'])
  for (const record of Object.values(registry.dataviews)) for (const step of record.manifest.steps) assert.ok(['rows', 'series'].includes(step))
  const module = generateExtensionsModule(registry)
  assert.match(module, /export const dataviews = \{\n"bar": \{ manifest: .*render: D0 \}/)
  assert.match(module, /import D0 from ".*dataviews\/bar\/view\.jsx"/)
})

test('axes: round ticks, as many decimals as the step, and bars rounded at their data end', () => {
  assert.deepEqual(niceTicks(0.3, 7.8), { min: 0, max: 8, ticks: [0, 2, 4, 6, 8], step: 2 })
  assert.deepEqual(niceTicks(95, 131, { zero: false }).ticks, [90, 100, 110, 120, 130, 140])
  assert.deepEqual(niceTicks(-0.31, 1).ticks, [-0.5, 0, 0.5, 1])
  const data = { columns: [{ decimals: 2 }], series: [{ column: 0 }], lang: 'de' }
  assert.equal(formatTick(data, 8, 2), '8')
  assert.equal(formatTick(data, 7.5, 2.5), '7,5')
  assert.match(barPath({ base: 100, end: 20, across: 10, thickness: 30 }), /^M10,100V24Q10,20 14,20H36Q40,20 40,24V100Z$/)
})

test('mdeck check names the problems of <data> tags at their lines', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'mdeck-data-check-'))
  const deck = resolve(dir, 'talk.md')
  writeFileSync(resolve(dir, 'ok.csv'), 'a;b\nx;1,5\n')
  const source = '# One\n\n<data show="pie">\na, b\nx, 1\n</data>\n\n---\n# Two\n\n<data src="gone.csv" />\n\n<data src="ok.csv" show="bar" colour="red" />\n\n<data show="bar">\nname, a, b, c, d\nx, 1, 2, 3, 4\n</data>\n'
  writeFileSync(deck, source)
  const found = dataDiagnostics(deck, builtInRegistry(), source)
  assert.deepEqual(found.map(d => [d.line, d.severity]), [[3, 'error'], [11, 'error'], [13, 'warning'], [15, 'warning']])
  assert.match(found[0].message, /no dataview is named so\. Available: bar,/)
  assert.match(found[1].message, /Missing data file: gone\.csv/)
  assert.match(found[2].message, /no option "colour"/)
  assert.match(found[3].message, /4 value columns; the palette has three accents/)
})

test('data files: bundled by the path the deck writes, followed when they change, moved with an included deck', async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'mdeck-data-files-'))
  mkdirSync(resolve(dir, 'data'))
  const deck = resolve(dir, 'slides.md')
  writeFileSync(resolve(dir, 'data/yields.csv'), 'year,n\n2024,1\n')
  writeFileSync(deck, '# Data\n\n<data src="./data/yields.csv" show="bar" />\n\n<data src="missing.csv" />\n')
  assert.deepEqual(Object.keys(dataFiles(deck)), ['./data/yields.csv'], 'a missing file is left to the slide and the check')
  assert.equal(rewriteAssetRefs('<data src="a.csv" />', ref => `lectures/${ref}`), '<data src="lectures/a.csv" />')
  const server = await createServer({
    configFile: false, root: dir, plugins: [slidesPlugin(deck)], appType: 'custom',
    cacheDir: resolve(dir, 'cache'), optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: { server: createHttpServer() } }, logLevel: 'silent',
  })
  const module = async () => (await server.transformRequest('virtual:deck-data')).code
  try {
    assert.match(await module(), /"\.\/data\/yields\.csv":"year,n\\n2024,1\\n"/)
    writeFileSync(resolve(dir, 'data/yields.csv'), 'year,n\n2024,2\n')
    const deadline = Date.now() + 5000
    while (!(await module()).includes('2024,2') && Date.now() < deadline) await delay(25)
    assert.match(await module(), /2024,2/, 'a changed file shows its new data')
  } finally {
    await server.close()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a deck\'s own dataview folder is a dataview of its own', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'mdeck-local-dataview-'))
  mkdirSync(resolve(dir, 'extensions/meter'), { recursive: true })
  writeFileSync(resolve(dir, 'extensions/meter/extension.toml'), 'schema = 1\nkind = "dataview"\nid = "meter"\ntitle = "Meter"\n')
  writeFileSync(resolve(dir, 'extensions/meter/view.jsx'), 'export default () => null\n')
  writeFileSync(resolve(dir, 'talk.md'), '# x\n')
  const registry = loadRegistry(resolve(dir, 'talk.md'), { userRoot: null })
  assert.equal(registry.dataviews.meter.source, 'local')
  assert.equal(registry.dataviews.meter.manifest.size, 'fixed')
})

test('a column that is not all numbers names its first cell that is not one', () => {
  const message = csv => buildDataset(csv, { y: 'value' }).problems.map(problem => problem.message).join('\n')
  assert.match(message('name, value\na, 1\nb, 2\nc, abc'), /row 3 has "abc"$/)
  assert.match(message('name, value\na, x\nb, 2\nc, y'), /row 1 has "x" \(and 1 more\)/)
})
