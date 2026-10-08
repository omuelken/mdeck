// Themes and palettes that once came with mdeck and now live in the theme
// repository. A deck that names one is told how to install it instead
// of being told the name is unknown.
export const MOVED = {
  themes: ['duet', 'editorial', 'fhnw', 'terminal', 'sketch', 'aurora'],
  palettes: ['terra', 'brand', 'phosphor', 'pastel', 'forest', 'neon'],
}

// Palettes that were removed because another one looks almost the same, by
// the one to use instead.
export const REPLACED = { palettes: { graphite: 'nordic', ember: 'paper' } }

// "The theme "duet" is no longer built into mdeck; install it with: mdeck
// themes install duet", what to use instead of a removed one, or null.
// Installing goes to every deck by default.
export function movedHint(kind, id) {
  const instead = REPLACED[`${kind}s`]?.[id]
  if (instead) return `The ${kind} "${id}" was removed from mdeck; use ${kind}: ${instead}, which looks almost the same`
  return MOVED[`${kind}s`]?.includes(id) ? `The ${kind} "${id}" is no longer built into mdeck; install it with: mdeck ${kind}s install ${id}` : null
}
