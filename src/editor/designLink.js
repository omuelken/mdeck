// The design page, where themes, palettes and layouts are made and changed.
// Both editor pages open it in the same named tab, so it is never open twice.
export const DESIGN_URL = '/design.html'
export const DESIGN_TAB = 'mdeck-design'

// `copy` starts a copy of a built-in extension to change; `open` opens one of
// the deck's own. Both are `kind:id`.
export function designUrl({ copy = null, open = null } = {}) {
  const query = new URLSearchParams()
  if (copy) query.set('copy', copy)
  if (open) query.set('open', open)
  return query.size ? `${DESIGN_URL}?${query}` : DESIGN_URL
}

// Reads `kind:id` back; null when it is not one.
export function parseTarget(value) {
  const match = /^(theme|palette|layout):([a-z][a-z0-9-]*)$/.exec(value ?? '')
  return match ? { kind: match[1], id: match[2] } : null
}
