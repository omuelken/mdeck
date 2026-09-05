// Browser-safe helpers shared by the runtime, the CLI and tests.

export const TOKEN_NAME_RE = /^--[a-z][a-z0-9-]*$/

export function tokensToCss(tokens = {}, selector = ':root') {
  const entries = Object.entries(tokens)
  if (!entries.length) return ''
  return `${selector} {\n  ${entries.map(([name, value]) => `${name}: ${value};`).join('\n  ')}\n}`
}
