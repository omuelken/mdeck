# Create interactive content

This guide is for people comfortable writing JavaScript. You do not need custom components to make ordinary presentations.

## Add a deck-local component

Create a `components` folder beside the deck's Markdown file. A file named `Greeting.jsx` is registered as the lowercase tag `<greeting>`:

```jsx
import { h } from 'preact'
import { useState } from 'preact/hooks'

export default function Greeting({ name = 'everyone' }) {
  const [visible, setVisible] = useState(false)
  return <div>
    <button onClick={() => setVisible(!visible)}>Show greeting</button>
    {visible && <p>Hello, {name}!</p>}
  </div>
}
```

Use it in an ordinary slide or a named region:

```html
<greeting name="garden team" />
```

The default export must be a Preact component. Deck-local discovery supports `.jsx` files. Import hooks from `preact/hooks`; the build resolves Preact to the framework's instance.

## How content reaches a component

HTML attributes arrive as string props. Text between the opening and closing tags arrives as the `children` string. The HTML-to-component bridge uses `textContent`; it does not pass a nested JSX tree.

Deck-local names override built-in component names. Avoid a collision unless you intend to replace that component for the whole deck.

## Assets and dependencies

Import assets from JSX so Vite can include them in builds. Install extra dependencies beside the deck, or in the framework checkout. Local component code is included only in decks that discover it.

Slides stay mounted while navigating. For media or ongoing work, listen to the `slidechange` event on `document.querySelector('deck-stage')` and check whether `event.detail.slide` contains your component. Clean up listeners when the component unmounts.

## Print and PDF

In a PDF every slide is on the page at once, and none of them is the active slide. Before printing, the stage reveals every step, sets the `data-deck-print` attribute on itself and dispatches a `printchange` event. A component that builds up step by step, or waits for its slide, should then show its finished state:

```jsx
useEffect(() => {
  const stage = document.querySelector('deck-stage')
  const sync = () => setFinished(stage?.printing)
  sync()
  stage?.addEventListener('printchange', sync)
  return () => stage?.removeEventListener('printchange', sync)
}, [])
```

Transitions are turned off in print, so the finished state appears immediately. Afterwards the stage puts each slide back to the step it was on.

## When to use a template instead

A component is a piece of a slide, such as an activity or visualization. A [template](custom-templates.html) arranges an entire slide and declares the areas and settings authors can fill in.
