import { h } from 'preact'
import { useMemo } from 'preact/hooks'
import QRCode from 'qrcode'

// <qrcode url="https://example.com" size="240" />
// Drawn in the slide's colours: the dark squares in the text colour, on the
// slide's own background, so it fits every theme and palette. Phone cameras
// read light-on-dark codes too. `--qr-ink` and `--qr-bg` override the colours,
// for example `--qr-bg: #fff` when a scanner needs a white background.
// An SVG, drawn at once, so it also prints and scales without blurring.
export default function QrCode({ url, size = '200' }) {
  const code = useMemo(() => {
    if (!url) return null
    try {
      const { modules } = QRCode.create(String(url), { errorCorrectionLevel: 'M' })
      let d = ''
      for (let y = 0; y < modules.size; y++) {
        for (let x = 0; x < modules.size; x++) if (modules.get(x, y)) d += `M${x} ${y}h1v1h-1z`
      }
      return { d, size: modules.size }
    } catch { return null }
  }, [url])
  if (!code) return null
  const quiet = 2, box = code.size + quiet * 2
  return <svg class="qrcode" viewBox={`${-quiet} ${-quiet} ${box} ${box}`} width={Number(size)} height={Number(size)} role="img" aria-label={url} shape-rendering="crispEdges"
    style={{ display: 'block', background: 'var(--qr-bg, transparent)', color: 'var(--qr-ink, var(--ink, currentColor))', borderRadius: '6px' }}>
    <path d={code.d} fill="currentColor" />
  </svg>
}
