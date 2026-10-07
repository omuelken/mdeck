import { h } from 'preact'

// The first slide in a theme and palette, as a small live picture: the
// deck's, or with `sample` the sample deck's. Empty values mean the deck's
// own, and light or dark stays the deck's unless `appearance` is given.
export function LookThumbnail({ theme = '', palette = '', appearance = '', sample = false }) {
  return <div class="thumb"><iframe src={`/?embedded=1${sample ? '&sample=1' : ''}&theme=${encodeURIComponent(theme)}&palette=${encodeURIComponent(palette)}${appearance ? `&appearance=${appearance}` : ''}`} title="" tabIndex={-1} loading="lazy" scrolling="no" /></div>
}
