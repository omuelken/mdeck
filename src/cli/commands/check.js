// mdeck check: mistakes in the deck, and with --render on its slides in Chrome.
import { formatDiagnostics } from '../../core/validateDeck.js'
import { checkDeck, bibliographyDiagnostics } from '../../build/check.js'
import { ok, tip } from '../ui.js'

export default async function check({ hasFlag, requireInput, registryFor }) {
  const input = requireInput('check')
  const registry = registryFor(input)
  const { diagnostics } = checkDeck(input, registry)
  diagnostics.push(...await bibliographyDiagnostics(input))
  if (hasFlag('--render') && !diagnostics.some(d => d.severity === 'error')) {
    tip('Building the deck and looking at every slide in Chrome…')
    try {
      const { renderCheck } = await import('../../build/renderCheck.js')
      diagnostics.push(...await renderCheck(input))
    } catch (error) { diagnostics.push({ severity: 'error', code: 'render', message: error.message, line: 1 }) }
  }
  if (diagnostics.length) console.log(formatDiagnostics(diagnostics, input))
  const warned = diagnostics.length || registry.warnings.length
  if (diagnostics.some(d => d.severity === 'error') || (warned && hasFlag('--strict'))) process.exitCode = 1
  else ok(`Checked ${input}${warned ? ' (with warnings)' : ''}`)
}
