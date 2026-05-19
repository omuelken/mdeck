import { h } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import QRCode from 'qrcode'

export default function QrCode({ url, size = '200' }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current || !url) return
    QRCode.toCanvas(canvasRef.current, url, {
      width: Number(size),
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
  }, [url, size])

  return <canvas ref={canvasRef} style={{ display: 'block' }} />
}
