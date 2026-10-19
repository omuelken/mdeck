import { h } from 'preact'

// Dark control chrome shared by the presenter view and the editor; the editor's
// stylesheet and the launch page use the same values.
export const S = {
  btn: {
    appearance: 'none',
    WebkitAppearance: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    padding: '5px 12px',
    borderRadius: '5px',
    // Longhands: a pressed button's borderColor goes back to this one when it
    // is let go; cleared under a shorthand, it left the browser's own colour.
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#3a3a3a',
    background: '#222',
    color: '#e0e0e0',
    cursor: 'pointer',
    fontSize: '13px',
    fontFamily: 'inherit',
    lineHeight: '1.5',
    outline: 'none',
  },
  select: {
    padding: '5px 8px',
    borderRadius: '5px',
    border: '1px solid #3a3a3a',
    background: '#222',
    color: '#e0e0e0',
    cursor: 'pointer',
    fontSize: '13px',
    fontFamily: 'inherit',
    width: '100%',
  },
  label: {
    color: '#a0a0a0',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: '5px',
    display: 'block',
  },
}

// A palette as the theme gallery shows it (mdeck-themes): one chip of its
// background, accent and second accent.
export function PaletteSwatches({ tokens }) {
  const stripe = key => <i style={{ display: 'block', background: tokens[key] ?? tokens['--accent'] ?? 'transparent' }} />
  return (
    <span aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', width: '30px', height: '18px', borderRadius: '999px', overflow: 'hidden', border: '1px solid rgba(127,127,127,0.35)', flexShrink: 0 }}>
      {stripe('--bg')}{stripe('--accent')}{stripe('--accent-2')}
    </span>
  )
}
