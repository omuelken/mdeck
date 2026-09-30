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
design: neue
components:
  - ../shared-components
  - ~/mdeck-components
---
```

Paths are relative to the deck's Markdown file; `~/` starts in your home folder. Every `.jsx` file in a listed folder becomes a tag, just like the deck's own `components` folder. Helper files in subfolders can be imported from those components.

When two folders have a component with the same name, the deck's own `components` folder wins, then the listed folders in their order, then mdeck's built-in components. Edits to a shared component reload every deck that is open in `mdeck dev`. `mdeck check` reports a listed folder that does not exist, and the launch page shows which folder each component comes from.

Builds contain the component code, so a built presentation does not need the shared folder. Someone who gets your slide file to work on needs that folder too.

## How content reaches a component

HTML attributes arrive as string props. Text between the opening and closing tags arrives as the `children` string. The HTML-to-component bridge uses `textContent`; it does not pass a nested JSX tree.

Deck-local names override built-in component names. Avoid a collision unless you intend to replace that component for the whole deck.

## Assets and dependencies

Import assets from JSX so Vite can include them in builds. Install extra dependencies beside the deck, or in the framework checkout. Local component code is included only in decks that discover it.

Slides stay mounted while navigating. For media or ongoing work, listen to the `slidechange` event on `document.querySelector('deck-stage')` and check whether `event.detail.slide` contains your component. Clean up listeners when the component unmounts.

## Audience interaction

Components can collect answers from phones. `useRoom` from `mdeck/live` connects to a room on the room server: phones post small messages to it, and every slide showing the room receives them live. The server does not interpret the messages, so any kind of activity works without changing it.

A component is written once and shown twice. On the slide it shows results and a QR code for `joinUrl`, the deck's one answer link. Phones that open it follow the presentation: whenever the presenter's current slide holds a component with a `room` attribute, mdeck renders only that component on the phones, with `respond` true. `?view=respond&room=<name>` opens one activity directly. Only the current slide's rooms stay connected, so a deck can hold many activities:

```jsx
import { h } from 'preact'
import { useRoom, QrCode } from 'mdeck/live'

export default function Words({ room }) {
  const { messages, send, respond, joinUrl } = useRoom(room)
  if (respond) return <form onSubmit={e => { e.preventDefault(); send({ word: e.currentTarget.word.value }) }}>
    <input name="word" /> <button>Send</button>
  </form>
  return <div>
    <p>{messages.map(m => m.data.word).join(' · ')}</p>
    {joinUrl && <QrCode url={joinUrl} size="280" />}
  </div>
}
```

`useRoom(room)` returns:

| Value | Meaning |
|---|---|
| `messages` | Every message so far, oldest first: `{ n, at, from, data }` |
| `send(data)` | Posts one message; resolves when the server has it. Keep `data` small (under 4 KB). |
| `respond` | True on a phone's answer page for this room |
| `joinUrl` | The deck's answer link for the QR code, or `null` when phones cannot reach the deck |
| `roomUrl` | A link to this activity alone |
| `me` | This device's id, the `from` of its own messages |
| `canReset`, `reset()` | Whether this browser may clear the room, and doing it |
| `connected` | Whether the live connection is open |

`QrCode` draws the code. `latestByDevice(messages)`, also from `mdeck/live`, keeps each device's latest message, for answers people may change. Where the room server runs and how phones reach the deck is described in [Ask your audience](audience.html).

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

## When to use a template instead

A component is a piece of a slide, such as an activity or visualization. A [template](custom-templates.html) arranges an entire slide and declares the areas and settings authors can fill in.
