// Content that does not fit its place on a slide. Code blocks are the usual
// cause: first their type gets smaller, down to a size still readable from
// the back of a room; only then do they get a smaller height, at least a few
// lines, and scroll inside (code-block.css). The output of run code is part
// of the same fit: when it appears, the code gives way, and if that is not
// enough, the output scrolls too. Whatever still overflows marks the slide with
// `data-overflow`, and the deck says so in the console, so a too-full slide
// is found while writing rather than on the projector.

const MIN_LINES = 4
// Output of run code keeps at least this many lines when it has to scroll.
const MIN_OUTPUT_LINES = 2
// The smallest code type, in slide pixels (a 1920 × 1080 slide).
const MIN_CODE_SIZE = 22

// The nearest box between the element and the slide whose content is taller
// than the box itself, and by how much.
function overflowAround(element, slide) {
  for (let box = element.parentElement; box && box !== slide.parentElement; box = box.parentElement) {
    const extra = box.scrollHeight - box.clientHeight
    if (extra > 1) return { box, extra }
  }
  return null
}

// The element that scrolls: the highlighted layer of editable code (the text
// field above it fills the same box), or the code itself.
const scroller = wrapper => wrapper.querySelector('.code-editable-highlight') ?? wrapper.querySelector('pre.code-block')

function lineHeight(element) {
  const style = getComputedStyle(element)
  return parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5 || 30
}

// The fade at the lower edge goes once the code is scrolled to its end. For
// editable code the text field scrolls and the highlighted layer follows.
function watchEnd(element, scrolling = element) {
  const update = () => element.classList.toggle('is-at-end', scrolling.scrollTop + scrolling.clientHeight >= scrolling.scrollHeight - 4)
  if (!scrolling.dataset.fitWatched) {
    scrolling.dataset.fitWatched = ''
    scrolling.addEventListener('scroll', update, { passive: true })
  }
  update()
}

// Smaller type first: the text of the code takes the height, the padding
// stays, so the size needed follows from how much is missing. The editable
// text field above highlighted code gets the same size, so the cursor stays
// on its letters.
function shrinkType(wrapper, element, slide) {
  const codes = [...wrapper.querySelectorAll('.code-block')]
  for (let step = 0; step < 4; step++) {
    const around = overflowAround(wrapper, slide)
    if (!around) return
    const size = parseFloat(getComputedStyle(element).fontSize)
    if (!(size > MIN_CODE_SIZE)) return
    const style = getComputedStyle(element)
    const text = element.scrollHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
    if (text <= 0) return
    const next = Math.max(MIN_CODE_SIZE, Math.floor(size * Math.max(0, text - around.extra - 2) / text))
    if (next >= size) return
    for (const code of codes) code.style.fontSize = `${next}px`
  }
}

/** Fits one slide's code blocks into the space they have; returns whether the slide still overflows. */
export function fitSlide(slide) {
  if (!slide) return false
  const blocks = [...slide.querySelectorAll('.code-block-wrapper')].map(wrapper => ({ wrapper, element: scroller(wrapper) })).filter(block => block.element)
  // Start from the natural size, so a slide that got more room fits again.
  for (const { wrapper, element } of blocks) {
    for (const code of wrapper.querySelectorAll('.code-block')) code.style.fontSize = ''
    element.style.maxHeight = ''
    const output = wrapper.querySelector('.code-output')
    if (output) { output.style.maxHeight = ''; output.style.fontSize = ''; output.classList.remove('is-capped') }
    element.classList.remove('is-capped')
    wrapper.querySelector('.code-editable-container')?.classList.remove('is-capped')
  }
  // The tallest code gives way first.
  blocks.sort((a, b) => b.element.offsetHeight - a.element.offsetHeight)
  for (const { wrapper, element } of blocks) {
    shrinkType(wrapper, element, slide)
    const smallest = lineHeight(element) * MIN_LINES
    // Measured again after each step: a column's scrollHeight leaves out
    // some margins, so one step can fall short.
    for (let step = 0; step < 4; step++) {
      const around = overflowAround(wrapper, slide)
      if (!around) break
      const height = Math.max(smallest, element.offsetHeight - around.extra - 2)
      if (height >= element.offsetHeight) break
      element.style.maxHeight = `${Math.floor(height)}px`
      element.classList.add('is-capped')
      wrapper.querySelector('.code-editable-container')?.classList.add('is-capped')
    }
    if (element.classList.contains('is-capped')) watchEnd(element, wrapper.querySelector('.code-editable-input') ?? element)
  }
  // Output in the code's type size; with the code at its smallest height and
  // the slide still too full, the output scrolls as well.
  for (const { wrapper, element } of blocks) {
    const output = wrapper.querySelector('.code-output')
    if (!output) continue
    output.style.fontSize = element.style.fontSize
    const around = overflowAround(output, slide)
    if (around) {
      const height = Math.max(lineHeight(output) * MIN_OUTPUT_LINES, output.offsetHeight - around.extra - 2)
      if (height < output.offsetHeight) output.style.maxHeight = `${Math.floor(height)}px`
    }
    if (output.scrollHeight > output.clientHeight + 2) {
      output.classList.add('is-capped')
      watchEnd(output)
    }
  }
  const body = slide.querySelector('.slide-body')
  const columns = [...slide.querySelectorAll('.slide-body, .split-left, .split-right, .text-pane')]
  const overflowing = columns.some(box => box.scrollHeight - box.clientHeight > 2) || (body && body.scrollHeight > body.clientHeight + 2)
  slide.toggleAttribute('data-overflow', overflowing)
  return overflowing
}

/**
 * Keeps the deck's slides fitted: the slide on screen when it is shown, all
 * of them once the fonts are there and when the size changes. Reports each
 * slide that is still too full once.
 */
export function fitDeck(stage, { report = true } = {}) {
  if (!stage) return () => {}
  const reported = new Set()
  const fit = slide => {
    if (!slide || !slide.offsetHeight) return
    if (fitSlide(slide) && report) {
      const id = slide.dataset.slideId ?? ''
      if (!reported.has(id)) {
        reported.add(id)
        console.warn(`mdeck: slide ${id} has more content than fits; it is cut off at the bottom.`)
      }
    }
  }
  const active = () => stage.querySelector(':scope > [data-deck-active]')
  const fitActive = () => requestAnimationFrame(() => fit(active()))
  stage.addEventListener('slidechange', fitActive)
  // A slide's content changed size, as when run code shows its output.
  const refit = event => requestAnimationFrame(() => fit(event.target.closest?.('.slide') ?? active()))
  stage.addEventListener('mdeck:refit', refit)
  document.fonts?.ready.then(fitActive)
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fitActive) : null
  observer?.observe(stage)
  fitActive()
  return () => { stage.removeEventListener('slidechange', fitActive); stage.removeEventListener('mdeck:refit', refit); observer?.disconnect() }
}
