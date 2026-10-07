// The design page, where themes, palettes and layouts are made and changed.
// Both editor pages open it in the same named tab, so it is never open twice.
export const DESIGN_URL = '/design.html'
export const DESIGN_TAB = 'mdeck-design'

// `copy` starts a copy of a built-in extension to change; `open` opens one of
// the deck's own. Both are `kind:id`. The launch page's address, if this
// editor came from it, is passed on.
export function designUrl({ copy = null, open = null } = {}) {
  const query = new URLSearchParams()
  if (copy) query.set('copy', copy)
  if (open) query.set('open', open)
  // A new tab does not share this one's memory: the way back goes along.
  const home = typeof location === 'undefined' ? null : launchPageUrl()
  if (home) query.set('home', home)
  return query.size ? `${DESIGN_URL}?${query}` : DESIGN_URL
}

// Reads `kind:id` back; null when it is not one.
export function parseTarget(value) {
  const match = /^(theme|palette|layout):([a-z][a-z0-9-]*)$/.exec(value ?? '')
  return match ? { kind: match[1], id: match[2] } : null
}

// The launch page of `mdeck run` that opened this editor, if one did: it
// passes its address as ?home=…, kept for this tab so that switching
// between the editor and the design page keeps the way back.
const HOME_KEY = 'mdeck-launch-page'
export function launchPageUrl() {
  let home = new URLSearchParams(location.search).get('home')
  try {
    if (home) sessionStorage.setItem(HOME_KEY, home)
    else home = sessionStorage.getItem(HOME_KEY)
  } catch {}
  try { return home && /^https?:$/.test(new URL(home).protocol) ? home : null } catch { return null }
}
