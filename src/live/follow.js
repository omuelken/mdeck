// Only the current slide's activities keep a live connection; while printing,
// all of them do. Returns a function that stops following.
import { setActiveRooms } from './client.js'
import { roomsOnSlide } from './roomTag.js'

export function followActiveRooms(stage, slides) {
  if (!stage || !slides.some(slide => roomsOnSlide(slide).length)) return () => {}
  const update = () => setActiveRooms(stage.printing ? null : roomsOnSlide(slides[stage.index]))
  update()
  stage.addEventListener('slidechange', update)
  stage.addEventListener('printchange', update)
  return () => {
    stage.removeEventListener('slidechange', update)
    stage.removeEventListener('printchange', update)
    setActiveRooms(null)
  }
}
