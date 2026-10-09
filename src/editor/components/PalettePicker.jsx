import { h } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { Icon } from '../../components/Icon.jsx'

export function Swatches({ tokens = {} }) {
  return <span class="swatches">{['--bg', '--surface', '--rule', '--accent', '--accent-2', '--accent-3', '--ink'].map(key => tokens[key] ? <i key={key} style={{ background: tokens[key] }} /> : null)}</span>
}

// The palettes a theme offers, each with its colours in the light or dark
// the deck shows, so they can be compared before choosing.
export function PalettePicker({ offered, selected, defaultId, appearance, onChoose }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = event => { if (event.type === 'keydown' ? event.key === 'Escape' : !ref.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close) }
  }, [open])
  const label = palette => <><span class="palette-name">{palette.title}{palette.id === defaultId && <span class="palette-default"> · theme default</span>}</span><Swatches tokens={palette[appearance] ?? {}} /></>
  return <div class="palette-picker" ref={ref}>
    <button type="button" class="palette-current" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(o => !o)}>
      {selected ? label(selected) : <span class="palette-name" />}
      <Icon name="dropdown" size={14} />
    </button>
    {open && <div class="palette-list" role="listbox" aria-label="Palette">
      {offered.map(palette => <button type="button" key={palette.id} role="option" aria-selected={palette.id === selected?.id} title={palette.description} class={palette.id === selected?.id ? 'is-active' : ''}
        onClick={() => { setOpen(false); onChoose(palette.id) }}>{label(palette)}</button>)}
    </div>}
  </div>
}
