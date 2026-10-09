// Contrast between palette colours (WCAG 2 relative luminance), so a palette
// that cannot be read is caught: in the tests for the built-in palettes, and
// as warnings from `mdeck check` for a deck's own.

function parseColor(text) {
  const value = String(text).trim().toLowerCase()
  let match = value.match(/^#([0-9a-f]{3,8})$/)
  if (match) {
    let hex = match[1]
    if (hex.length === 3 || hex.length === 4) hex = [...hex].map(c => c + c).join('')
    return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16))
  }
  match = value.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/)
  if (match) return match.slice(1, 4).map(Number)
  return null
}

function luminance([r, g, b]) {
  const channel = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** The contrast ratio of two colours (1 to 21), or null when one is not a plain colour. */
export function contrast(a, b) {
  const x = parseColor(a), y = parseColor(b)
  if (!x || !y) return null
  const [light, dark] = [luminance(x), luminance(y)].sort((p, q) => q - p)
  return (light + 0.05) / (dark + 0.05)
}

// What a slide needs to be read from the back of a room.
const RULES = [
  ['--ink', '--bg', 7, 'text'],
  ['--ink-soft', '--bg', 4.5, 'secondary text'],
  ['--muted', '--bg', 4.5, 'muted text'],
  ['--accent', '--bg', 3, 'the accent'],
  ['--accent-2', '--bg', 3, 'the second accent'],
  // A marker (bars, shapes), not text: it has to be seen, not read.
  ['--accent-3', '--bg', 1.5, 'the third accent'],
  ['--on-accent', '--accent', 3, 'text on the accent'],
]

/**
 * Pairs of a palette's colours that are too close to read, as messages.
 * A private palette (one theme's corporate colours) may use its accent as a
 * surface only, so its accents are not checked as text.
 */
export function paletteProblems(palette) {
  const problems = []
  for (const appearance of ['light', 'dark']) {
    const tokens = palette[appearance] ?? {}
    for (const [fore, back, minimum, what] of RULES) {
      if (palette.theme && (fore === '--accent' || fore === '--accent-2' || fore === '--accent-3')) continue
      const ratio = contrast(tokens[fore], tokens[back])
      if (ratio != null && ratio < minimum) problems.push(`${appearance}: ${what} (${fore} on ${back}) has a contrast of ${ratio.toFixed(1)}:1; at least ${minimum}:1 is needed`)
    }
  }
  return problems
}
