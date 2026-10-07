// Themes and palettes that came with mdeck before 3.0 and now live in the
// theme repository, by the pack that has them. A deck that names one is told
// how to install it instead of being told the name is unknown.
export const MOVED = {
  themes: { duet: 'duet', editorial: 'editorial', fhnw: 'fhnw', terminal: 'terminal', sketch: 'sketch' },
  palettes: { cobalt: 'duet', terra: 'editorial', brand: 'fhnw', phosphor: 'terminal', pastel: 'sketch', ember: 'earth', forest: 'earth' },
}

// "The theme "duet" is no longer built in: mdeck themes install duet", or null.
export function movedHint(kind, id) {
  const pack = MOVED[`${kind}s`]?.[id]
  return pack ? `The ${kind} "${id}" is no longer built into mdeck; install it beside the deck with: mdeck themes install ${pack}` : null
}
