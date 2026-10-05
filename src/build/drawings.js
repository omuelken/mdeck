import { existsSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { inkFileFor, oldInkFileFor } from '../core/ink.js'

export function drawingsDiagnostic(slidesPath) {
  const file = inkFileFor(resolve(slidesPath)), old = oldInkFileFor(resolve(slidesPath))
  if (existsSync(old) && !existsSync(file)) return { severity: 'error', code: 'renamed-file', message: `${basename(old)} is now ${basename(file)}: run mdeck migrate to keep your drawings`, line: 1, column: 1 }
  return null
}

export function assertDrawings(slidesPath) {
  const problem = drawingsDiagnostic(slidesPath)
  if (problem) throw new Error(problem.message)
}
