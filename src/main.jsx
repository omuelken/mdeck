import { h, render } from 'preact'
import slidesContent from 'virtual:slides'
import { parseSlides } from './parseSlides'
import { loadTheme } from './themeLoader'
import { SlideRenderer } from './renderSlide'
import './markedSetup'
import '../deck-stage.js'

async function init() {
  const { deckConfig, slides } = parseSlides(slidesContent)
  await loadTheme(deckConfig)

  const app = (
    <deck-stage width={deckConfig.width ?? 1920} height={deckConfig.height ?? 1080}>
      {slides.map((slide, i) => (
        <SlideRenderer
          key={i}
          meta={slide.meta}
          content={slide.content}
          deckConfig={deckConfig}
          index={i}
          total={slides.length}
        />
      ))}
    </deck-stage>
  )

  render(app, document.body)
}

init()
