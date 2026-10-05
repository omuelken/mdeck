import { h } from 'preact'
import { ICONS, ICON_STROKE } from '../core/icons.js'

// One icon from the shared set (src/core/icons.js). It takes the text colour,
// so a button only has to set `color`.
export function Icon({ name, size = 16, class: className = 'icon', style }) {
  return <svg class={className} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" stroke-width={ICON_STROKE} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style={style} dangerouslySetInnerHTML={{ __html: ICONS[name] }} />
}
