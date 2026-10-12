// `mdeck/component`: what a deck component may use from mdeck. Everything
// here is a promise kept across versions; anything else a component reaches
// (the page outside its slide, the stage, the presenter view) is not, and may
// change without notice. See "Deck-local components" in the authoring
// reference.
import { useEffect, useState } from 'preact/hooks'
import { getShared, setShared, subscribeShared, currentView } from './shared.js'

/**
 * A value shared by every slide and every window of this talk, under `name`.
 * Returns [value, setValue]; `initial` stands in until someone sets one.
 * Values must survive JSON. The latest change wins.
 */
export function useShared(name, initial = null) {
  const [value, setValue] = useState(() => getShared(name))
  useEffect(() => {
    setValue(getShared(name))
    return subscribeShared(name, setValue)
  }, [name])
  const current = () => getShared(name) === undefined ? initial : getShared(name)
  return [value === undefined ? initial : value, next => setShared(name, typeof next === 'function' ? next(current()) : next)]
}

/** The kind of window this is: presenter, audience, deck, follow, preview or reader. */
export function useView() {
  return currentView()
}
