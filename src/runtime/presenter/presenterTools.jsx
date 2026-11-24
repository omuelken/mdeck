// A deck component's own tool in the presenter view's bar, beside the timer:
// a button and the panel it opens (`<PresenterTool>`, from `mdeck/component`).
//
// The component runs in the presenter's slide frame, the bar in the page
// around it, at the same address. The bar keeps an empty place for such tools
// (PresenterToolSlot) and names it on its window; the frame renders the tool
// into it, with its own Preact, so the tool keeps the component's state and
// hooks. A tool follows the place when the presenter view changes its layout,
// and leaves it when the frame reloads.
import { h, Component, render } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { Popover } from './PresenterChrome.jsx'
import { currentView } from '../shared.js'

const SLOT = 'mdeckPresenterTools'
const CHANGED = 'mdeck-presenter-tools'

/** The place in the bar. It renders once; the tools are not Preact's here.
 * A tool's panel lines up with the bar's end, so the bar is positioned. */
export class PresenterToolSlot extends Component {
  shouldComponentUpdate() { return false }
  componentDidMount() { window[SLOT] = this.base; window.dispatchEvent(new Event(CHANGED)) }
  componentWillUnmount() {
    if (window[SLOT] !== this.base) return
    window[SLOT] = null
    window.dispatchEvent(new Event(CHANGED))
  }
  render() { return <span class="presenter-tools" style={{ display: 'contents' }} /> }
}

// The bar's place, seen from the presenter's slide frame; null anywhere else.
function useSlot() {
  const [slot, setSlot] = useState(null)
  useEffect(() => {
    if (currentView() !== 'presenter' || window.parent === window) return
    let page
    try { page = window.parent; if (!page.document) return } catch { return }
    const update = () => setSlot(page[SLOT] ?? null)
    page.addEventListener(CHANGED, update)
    update()
    return () => page.removeEventListener(CHANGED, update)
  }, [])
  return slot
}

/**
 * A button in the presenter view's bar, beside the timer, that opens a panel
 * (`children`). `label` names it; `button` is what the button shows (an icon,
 * a short text). `css` styles both: they stand in the presenter view's page,
 * not in the slide, so the component's own styles do not reach them. Only the
 * presenter view shows it; elsewhere it renders nothing.
 */
export function PresenterTool({ label, button, css, children }) {
  const slot = useSlot()
  const host = useRef(null)
  useEffect(() => {
    if (!slot) return
    const page = slot.ownerDocument
    const element = page.createElement('span')
    element.style.display = 'contents'
    slot.appendChild(element)
    host.current = element
    let style = null
    if (css) { style = page.createElement('style'); style.textContent = css; page.head.appendChild(style) }
    // A frame that reloads or goes takes its tool along; effects do not run then.
    const leave = () => { render(null, element); element.remove(); style?.remove(); host.current = null }
    window.addEventListener('pagehide', leave)
    return () => { window.removeEventListener('pagehide', leave); leave() }
  }, [slot, css])
  useEffect(() => {
    if (host.current) render(<Popover class="presenter-tool" label={label} trigger={button} inBar>{children}</Popover>, host.current)
  })
  return null
}
