// mdeck results: the answers kept in the talk, as CSV or JSON.
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve, basename, relative } from 'path'
import { expandedSource } from '../../build/include.js'
import { parseSlides } from '../../core/parseSlides.js'
import { resultsFileFor, normalizeResults } from '../../core/results.js'
import { resultsReport, reportAnswersCsv, reportSummaryCsv, reportJson } from '../../core/resultsReport.js'
import { ok, err } from '../ui.js'

export default async function exportResults({ hasFlag, outputOption, requireInput }) {
  const input = requireInput('results')
  const file = resultsFileFor(resolve(input))
  if (!existsSync(file)) { err(`No answers kept for ${basename(input)} yet: ${basename(file)} appears beside it once people answer during mdeck run.`); process.exit(1) }
  let results
  try { results = normalizeResults(JSON.parse(readFileSync(file, 'utf8'))) } catch (error) { err(`${basename(file)}: ${error.message}`); process.exit(1) }
  // Read against the deck as shown, included slides too, for the slide and the question.
  let deck
  try { deck = parseSlides(expandedSource(resolve(input))) } catch { deck = parseSlides(readFileSync(resolve(input), 'utf8')) }
  const report = resultsReport(results, deck)
  const out = outputOption()
  const json = hasFlag('--json') || /\.json$/i.test(out ?? '')
  const text = json ? reportJson(report, { title: deck.deckConfig?.meta?.title ?? basename(input).replace(/\.md$/i, '') })
    : hasFlag('--summary') ? reportSummaryCsv(report) : reportAnswersCsv(report)
  if (out) { writeFileSync(out, text); ok(`Saved ${relative(process.cwd(), resolve(out))}`) }
  else process.stdout.write(text)
}
