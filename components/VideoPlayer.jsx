import { h } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import './video-player.css'

function getEmbedUrl(rawUrl, autoplay = false) {
  const ap = autoplay
  const yt = rawUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0${ap ? '&autoplay=1&mute=1' : ''}`
  const vi = rawUrl.match(/vimeo\.com\/(\d+)/)
  if (vi) return `https://player.vimeo.com/video/${vi[1]}${ap ? '?autoplay=1&muted=1' : ''}`
  const sw = rawUrl.match(/tube\.switch\.ch\/(?:videos|embed)\/([\w-]+)/)
  if (sw) return `https://tube.switch.ch/embed/${sw[1]}${ap ? '?autoplay=1' : ''}`
  return rawUrl
}

export default function VideoPlayer({ src, url, play = 'click', aspect, muted }) {
  const containerRef = useRef(null)
  const videoRef     = useRef(null)

  // The HtmlContent hydration wrapper has no width; stretch it so percentage widths work
  useEffect(() => {
    if (containerRef.current?.parentElement) {
      containerRef.current.parentElement.style.width = '100%'
    }
  }, [])

  // Preact doesn't reliably apply the muted attribute via props — set it on the DOM node directly
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = (play === 'auto' || muted != null)
  }, [play, muted])
  // Web video: click mode renders immediately; auto mode starts null and is set by slidechange
  const [iframeSrc, setIframeSrc] = useState(
    url && play === 'click' ? getEmbedUrl(url, false) : null
  )

  // Local video: pause on slide deactivation for all modes; also play on activation for "auto"
  useEffect(() => {
    if (!src) return
    const stage = document.querySelector('deck-stage')
    if (!stage) return

    // If already on the active slide when we mount, play immediately for auto mode
    if (play === 'auto') {
      const active = stage.querySelector('[data-deck-active]')
      if (active?.contains(containerRef.current)) videoRef.current?.play()
    }

    function onSlideChange(e) {
      const active = e.detail.slide?.contains(containerRef.current)
      if (active && play === 'auto') {
        videoRef.current?.play()
      } else if (!active) {
        videoRef.current?.pause()
        if (play === 'auto' && videoRef.current) videoRef.current.currentTime = 0
      }
    }
    stage.addEventListener('slidechange', onSlideChange)
    return () => stage.removeEventListener('slidechange', onSlideChange)
  }, [play, src])

  // Web video auto mode: clear/restore src on slide change to stop/start playback
  useEffect(() => {
    if (play !== 'auto' || !url) return
    const stage = document.querySelector('deck-stage')
    if (!stage) return
    const embedUrl = getEmbedUrl(url, true)

    // Check immediately in case we mounted after the init slidechange fired
    const active = stage.querySelector('[data-deck-active]')
    if (active?.contains(containerRef.current)) setIframeSrc(embedUrl)

    function onSlideChange(e) {
      const active = e.detail.slide?.contains(containerRef.current)
      setIframeSrc(active ? embedUrl : null)
    }
    stage.addEventListener('slidechange', onSlideChange)
    return () => stage.removeEventListener('slidechange', onSlideChange)
  }, [play, url])

  const fixedAspect = typeof aspect === 'string' && aspect.trim() !== ''

  return (
    <div
      ref={containerRef}
      class="video-player-container"
      style={fixedAspect ? { aspectRatio: aspect } : undefined}
    >
      {url ? (
        iframeSrc
          ? <iframe src={iframeSrc} allow="autoplay; fullscreen" allowFullScreen
              style={{ width: '100%', height: fixedAspect ? '100%' : 'auto', aspectRatio: fixedAspect ? undefined : '16 / 9', border: '0', display: 'block' }} />
          : <div class="video-player-placeholder" />
      ) : (
        <video
          ref={videoRef}
          src={src}
          controls
          style={{ width: '100%', height: fixedAspect ? '100%' : 'auto', display: 'block' }}
        />
      )}
    </div>
  )
}
