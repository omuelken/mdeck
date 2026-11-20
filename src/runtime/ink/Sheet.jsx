import { h } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { sheetLayer, sheetScale } from '../../core/ink.js'
import { useSlideSheet } from './store.js'
import { InkLayer } from './InkLayer.jsx'

// A notes sheet (core/ink.js): the slide small in the top left corner, as a
// still copy with every step shown and its drawings, and room around it to
// write on, with the sheet's own strokes. `copy` is the slide rendered once
// more, without its sheet (renderSlide.jsx).
function SheetContent({ id, sheet, copy, width, height }) {
  const scale = sheetScale(sheet)
  return <>
    <div class="sheet-copy" style={{ width: `${width * scale}px`, height: `${height * scale}px` }}>
      <div class="sheet-scale" style={{ width: `${width}px`, height: `${height}px`, transform: `scale(${scale})` }}>
        <div class="slide-copy" data-slide-copy data-deck-static inert aria-hidden="true">{copy}</div>
      </div>
    </div>
    <InkLayer slideId={sheetLayer(id)} />
  </>
}

/**
 * On the stage the sheet is the slide's last step: it covers the slide once
 * the presenter goes on past the slide's own steps. When it comes or goes
 * while the slide is shown, the stage counts the steps again (stepsChanged).
 */
export function SheetStep({ id, copy, width, height }) {
  const sheet = useSlideSheet(id)
  const anchor = useRef()
  const had = useRef(!!sheet)
  useEffect(() => {
    if (had.current === !!sheet) return
    had.current = !!sheet
    anchor.current?.closest('deck-stage')?.stepsChanged?.()
  }, [!!sheet])
  if (!sheet) return <span ref={anchor} hidden />
  return <div ref={anchor} class="slide-sheet" data-step data-sheet-step>
    <SheetContent id={id} sheet={sheet} copy={copy} width={width} height={height} />
  </div>
}

/**
 * In print, PDFs and the reader's Read mode the sheet is a page of its own,
 * after its slide. On the stage it is no slide (deck-stage leaves out
 * [data-sheet-page]) and stays hidden.
 */
export function SheetPage({ id, copy, width, height }) {
  const sheet = useSlideSheet(id)
  return <section class="slide sheet-page" data-sheet-page data-sheet-of={id} hidden={!sheet}>
    {sheet && <SheetContent id={id} sheet={sheet} copy={copy} width={width} height={height} />}
  </section>
}
