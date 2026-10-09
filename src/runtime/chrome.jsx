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
    border: '1px solid #3a3a3a',
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

export function PaletteSwatches({ tokens }) {
  const keys = ['--bg', '--surface', '--rule', '--accent', '--accent-2', '--accent-3', '--ink']
  return (
    <div style={{ display: 'flex', gap: '2px', alignItems: 'center', flexShrink: 0 }}>
      {keys.map(k => tokens[k]
        ? <div key={k} style={{ width: '10px', height: '10px', borderRadius: '2px', background: tokens[k], border: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }} />
        : null
      )}
    </div>
  )
}
