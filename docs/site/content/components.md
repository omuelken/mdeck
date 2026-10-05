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

## Share components between decks

To use the same components in several decks, keep them in one folder and list it in each deck's settings:

```yaml
---
theme: neue
components:
  - ../shared-components
  - ~/mdeck-components
---
```

Paths are relative to the deck's Markdown file; `~/` starts in your home folder. Every `.jsx` file in a listed folder becomes a tag, just like the deck's own `components` folder. Helper files in subfolders can be imported from those components.

When two folders have a component with the same name, the deck's own `components` folder wins, then the listed folders in their order, then mdeck's built-in components. Edits to a shared component reload every deck that is open in `mdeck run`. `mdeck check` reports a listed folder that does not exist.

Builds contain the component code, so a built presentation does not need the shared folder. Someone who gets your slide file to work on needs that folder too.

## How content reaches a component

HTML attributes arrive as string props. Text between the opening and closing tags arrives as the `children` string. The HTML-to-component bridge uses `textContent`; it does not pass a nested JSX tree.

Deck-local names override built-in component names. Avoid a collision unless you intend to replace that component for the whole deck.

## Assets and dependencies

Import assets from JSX so Vite can include them in builds. Install extra dependencies beside the deck, or in the framework checkout. Local component code is included only in decks that discover it.

Slides stay mounted while navigating. For media or ongoing work, listen to the `slidechange` event on `document.querySelector('deck-stage')` and check whether `event.detail.slide` contains your component. Clean up listeners when the component unmounts.

## Audience interaction

Components can collect answers from phones. An activity has two halves:

- **On the slide**, the component itself shows the answers. `useRoom` from `mdeck/live` follows its room on the server and receives every answer live.
- **On the phones**, the server's answer page shows a form. The component describes that form with a static `phone` function; mdeck calls it for the activity on the presenter's current slide and sends the result to the phones.

The phones never load the deck, so the form is a description, not code. Three kinds are available:

| `type` | Shows | Other fields | An answer's `value` |
|---|---|---|---|
| `choice` | One button per option; the latest tap counts | `options` (list of text) | The chosen option |
| `text` | A text box and a send button; any number of answers | `placeholder`, `maxLength` (default 200) | The text |
| `scale` | A row of numbers | `min` (default 1), `max` (default 5), `minLabel`, `maxLabel` | The number |

Each takes a `question`. A word collector:

```jsx
import { h } from 'preact'
import { useRoom, QrCode } from 'mdeck/live'

export default function Words({ room }) {
  const { messages, joinUrl, localJoinUrl } = useRoom(room)
  return <div>
    <p>{messages.map(m => m.data.value).join(' · ')}</p>
    {joinUrl ? <QrCode url={joinUrl} size="280" /> : <a href={localJoinUrl}>Try the answer page</a>}
  </div>
}

// What the phones show while this slide is on screen.
Words.phone = ({ question }, { slideTitle }) => ({ type: 'text', question: question || slideTitle, placeholder: 'One word' })
```

`phone(props, { slideTitle })` receives the tag's attributes and the slide's heading. A component without `phone` still shows answers on the slide, but the phones keep waiting while it is on screen. Only the current slide's rooms stay connected, so a deck can hold many activities.

`useRoom(room)` returns:

| Value | Meaning |
|---|---|
| `messages` | Every answer so far, oldest first: `{ n, at, from, data: { value } }` |
| `joinUrl` | The deck's join link for the QR code, or `null` when phones cannot reach the server |
| `localJoinUrl` | The answer page on this computer, for trying it out |
| `code` | The deck's session code |
| `canReset`, `reset()` | Whether this browser may clear the room, and doing it |
| `connected` | Whether the live connection is open |

`QrCode` draws the code. `latestByDevice(messages)`, also from `mdeck/live`, keeps each device's latest answer, for answers people may change. Where the server runs is described in [Ask your audience](audience.html).

## Print, PDF and Read mode

In a PDF, and in the reader's Read mode, every slide is shown at once and none of them is the active slide. There, mdeck reveals every step and places the slide inside an element with the `data-deck-static` attribute. A component that builds up step by step, or waits for its slide, should then show its finished state. Printing can start while the deck is open, so also listen for the stage's `printchange` event:

```jsx
useEffect(() => {
  const stage = document.querySelector('deck-stage')
  const sync = () => setFinished(!!ref.current.closest('[data-deck-static]'))
  sync()
  stage?.addEventListener('printchange', sync)
  return () => stage?.removeEventListener('printchange', sync)
}, [])
```

Transitions are turned off in print, so the finished state appears immediately. After printing, the stage puts each slide back to the step it was on.

## When to use a layout instead

A component is a piece of a slide, such as an activity or visualization. A [layout](custom-layouts.html) arranges an entire slide and declares the areas and settings authors can fill in.
