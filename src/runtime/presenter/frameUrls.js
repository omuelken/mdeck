// The addresses of the presenter view's frames and its audience window.

// URL for the presenter's own iframe and preview pane (uses postMessage)
export function buildChildUrl(theme, palette, appearance, slideIndex = null, { draw = false, remote = false } = {}) {
  const url = new URL(window.location.href)
  url.searchParams.delete('v')
  url.searchParams.set('view', 'deck')
  url.searchParams.set('embedded', '1')
  if (draw) url.searchParams.set('draw', '1')
  // A phone's small slide is for looking; it does not start drawing.
  if (remote) url.searchParams.set('remote', '1')
  else url.searchParams.delete('remote')
  if (theme) url.searchParams.set('theme', theme)
  else url.searchParams.delete('theme')
  setLookParams(url, palette, appearance)
  if (slideIndex != null) url.hash = String(slideIndex + 1)
  return url.toString()
}

// The palette and light or dark chosen in the presenter view, for its frames
// and the audience window.
function setLookParams(url, palette, appearance) {
  // Always set: empty means the theme's default (see withConfigOverrides).
  url.searchParams.set('palette', palette ?? '')
  url.searchParams.set('appearance', appearance ?? '')
}

// URL for the audience window — view=audience makes it listen on BroadcastChannel
export function buildAudienceUrl(theme, palette, appearance, slideIndex = null) {
  const url = new URL(window.location.href)
  url.searchParams.delete('embedded')
  url.searchParams.delete('v')
  url.searchParams.set('view', 'audience')
  if (theme) url.searchParams.set('theme', theme)
  else url.searchParams.delete('theme')
  setLookParams(url, palette, appearance)
  if (slideIndex != null) url.hash = String(slideIndex + 1)
  return url.toString()
}
