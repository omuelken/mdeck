// Numbers typed on a phone for <numeric>. The answer page has its own copy
// of parseNumber (src/live/answer/answer.js), as it has no build step.

/** 0.5, 0,5, −3, 1e-3 or 1/2 as a number; null for anything else. */
export function parseNumber(text) {
  const plain = String(text ?? '').trim().replace(/\s+/g, '').replace(/−/g, '-').replace(/(\d),(\d)/g, '$1.$2')
  const parts = plain.match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(?:\/((?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?))?$/i)
  if (!parts) return null
  const value = parts[2] ? Number(parts[1]) / Number(parts[2]) : Number(parts[1])
  return Number.isFinite(value) ? value : null
}

/**
 * The answers grouped by value, most frequent first: [{ value, text, n }].
 * `text` is how most people typed it (0.5, or 1/2). Values that differ only
 * in the last digits of a float (1/3 and 0.333333333333) count as one.
 */
export function groupNumbers(texts) {
  const groups = new Map()
  for (const text of texts) {
    const value = parseNumber(text)
    if (value == null) continue
    const key = Number(value.toPrecision(12))
    const group = groups.get(key) ?? { value, n: 0, spellings: new Map() }
    const spelling = String(text).trim()
    group.n++
    group.spellings.set(spelling, (group.spellings.get(spelling) ?? 0) + 1)
    groups.set(key, group)
  }
  return [...groups.values()]
    .map(({ value, n, spellings }) => ({ value, n, text: [...spellings].sort((a, b) => b[1] - a[1])[0][0] }))
    .sort((a, b) => b.n - a.n || a.value - b.value)
}

/** Whether `value` is the answer, give or take `tolerance` (0: equal, as far as floats go). */
export function isRightNumber(value, answer, tolerance = 0) {
  if (value == null || answer == null) return false
  return Math.abs(value - answer) <= Math.max(tolerance, 1e-9 * Math.max(1, Math.abs(answer)))
}
