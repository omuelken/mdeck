---
theme: glass
meta:
  title: "A tour of mdeck"
  author: "Tilman Schieber"
  organization: "FHNW"
  date: "2026-10-06"
---

---
:::meta
layout: title
image: ./img/mdeck.svg
fit: contain
alt: "A Markdown file turning into a stack of slides"
id: a-talk-in-a-text-file
:::
# A talk in a text file.
## A tour of mdeck: each slide shows *what is written* and what it becomes.

:::notes
This deck teaches mdeck by example. Most slides show the Markdown beside what it becomes. Open `slides.md` next to it: every slide here is written exactly as shown.

Go through it with the arrow keys or the space bar. These notes are only for you; open the presenter view from the launch page to see them beside the slide.
:::

---
:::meta
layout: chapter
number: 1
part: Writing
description: Plain Markdown, the format AI assistants already write. You can read and change every word.
:::
# Write it.

:::notes
In practice an AI assistant usually writes this file from your own material: old slides, a document, your notes. The `write-slides` skill teaches it mdeck. The next slides show what it writes, so you can read and adjust it.
:::

---
:::meta
layout: split
:::
# Words become slides
:::slot left
```markdown
# Our next adventure

A paragraph of ordinary text.

---

# The next idea
```
:::
:::slot right
## Our next adventure

A paragraph of ordinary text.

Three dashes on a line of their own start the next slide.
:::

:::notes
`#` is the slide's heading. A blank line separates paragraphs.

Try it: change a heading in `slides.md` and save. The slide updates while it is open.
:::

---
:::meta
layout: split
:::
# Lists and emphasis
:::slot left
```markdown
- Bring a notebook.
- Ask **one good question**.
- Share what *you* learn.

1. Listen
2. Summarize
```
:::
:::slot right
- Bring a notebook.
- Ask **one good question**.
- Share what *you* learn.

1. Listen
2. Summarize
:::

:::notes
`**bold**` and `*emphasis*`; the theme decides how emphasis looks. In this theme it takes the accent colour.
:::

---
# Reveal points one at a time

:::columns
```markdown
:::steps
- First, a question.
- Then, a pause.
- Then, the answer.
:::
```
+++
:::steps
- First, a question.
- Then, a pause.
- Then, the answer.
:::
:::

:::notes
Press the next key: each press reveals one point, then moves on. Printed slides and the PDF show all the points.

This slide has no layout: `:::columns` puts the source and the result side by side, and `+++` starts the second column.
:::

---
:::meta
layout: chapter
number: 2
part: Layouts and content
description: Layouts, pictures, code, tables and callouts. Pick a layout per slide; the theme does the rest.
:::
# Lay it out.

---
:::meta
layout: split
props:
  ratio: [3, 2]
:::
# Choose a layout
:::slot left
```markdown
:::meta
layout: focus
attribution: "A teacher"
:::
# Good questions make
# better conversations.
```
:::
:::slot right
A `:::meta` block at the top of a slide holds its settings.

`layout: focus` makes one large statement. The next slide is exactly this.
:::

:::notes
Without a layout, a slide is an ordinary heading with content. This slide is `layout: split`, with the two sides written as `:::slot left` and `:::slot right`; `ratio: [3, 2]` gives the code more room.

The built-in layouts are `title`, `chapter`, `focus`, `split`, `image-text` and `full-bleed-image`.
:::

---
:::meta
layout: focus
attribution: "A teacher"
:::
# Good questions make better conversations.

---
:::meta
layout: image-text
image: ./img/image.jpg
alt: "Contour lines like those on a map"
:::
# A picture beside your words

```markdown
:::meta
layout: image-text
image: ./img/image.jpg
alt: "Contour lines"
:::
```

`alt` describes the picture for people who cannot see it.

:::notes
Keep pictures in a folder beside the slides, here `img/`. The next slide uses the same picture with `layout: full-bleed-image`.
:::

---
:::meta
layout: full-bleed-image
image: ./img/image.jpg
alt: "Contour lines like those on a map"
overlay: true
:::
# Or let the picture fill the slide.

:::notes
This slide is written as:

```markdown
:::meta
layout: full-bleed-image
image: ./img/image.jpg
overlay: true
:::
# Or let the picture fill the slide.
```

`overlay: true` darkens the picture so the heading stays readable.
:::

---
:::meta
layout: split
:::
# Code you can run
:::slot left
````markdown
```python live editable
squares = [x**2 for x in range(1, 6)]
print(squares)
```
````
:::
:::slot right
```python live editable
squares = [x**2 for x in range(1, 6)]
print(squares)
```
:::

:::notes
Press Run. `live` adds the button, `editable` lets you change the code while presenting, `copy` adds a copy button. JavaScript works the same way.

Live Python downloads its runtime the first time, so it needs an internet connection.
:::

---
:::meta
layout: split
:::
# Tables and formulas
:::slot left
```markdown
| Layer | Who owns it |
|---|---|
| Words | You |
| Look | The theme |

$$
A = \pi r^2
$$
```
:::
:::slot right
| Layer | Who owns it |
|---|---|
| Words | You |
| Look | The theme |

$$
A = \pi r^2
$$
:::

:::notes
Formulas use LaTeX. Single dollar signs put a formula inside a sentence; two dollar signs above and below put it on its own line.
:::

---
:::meta
layout: split
:::
# Tips and warnings
:::slot left
```markdown
:::tip
One tip per slide is plenty.
:::

:::warning
Check the room's projector.
:::
```
:::
:::slot right
:::tip
One tip per slide is plenty.
:::

:::warning
Check the room's projector.
:::
:::

:::notes
The other callouts are `note`, `important` and `caution`. Add your own label after the type, for example `:::tip Before the talk`.
:::

---
:::meta
layout: chapter
number: 3
part: Presenting
description: Notes for you, drawing on the slides, and questions for the room.
id: give-the-talk
:::
# Give the talk.

---
:::meta
layout: split
:::
# Notes only you can see
:::slot left
```markdown
:::notes
Pause here. Ask who has
tried this before.
:::
```
:::
:::slot right
Notes go below the slide's content. They appear in the **presenter view**, never on the projector.

Open it from the launch page, and move the **audience window** onto the projector. The two follow each other.
:::

:::notes
Pause here. Ask who has tried this before.

This is what the presenter view shows for this slide. Its header also shows what is connected: other presenter views, audience windows and phones.
:::

---
:::meta
id: draw-on-any-slide
:::
# Draw on any slide

Press **D** now, or the pen button. Draw with a pen, a highlighter, or a marker that fades after a moment. **Escape** stops.

Drawings are kept in `slides.drawings.json` beside the slides, and appear in the PDF.

:::notes
The underline and the circle on this slide were drawn with the pen and saved; they show in every view and in the PDF.

On an iPad, pair it from the launch page: you draw and steer there while the laptop drives the projector.
:::

---
# Which part will you try first?

<poll room="tour" options="Writing|Layouts|Drawing|Polls" />

:::notes
One line makes a poll; the heading is the question:

`<poll room="tour" options="Writing|Layouts|Drawing|Polls" />`

Phones join with the QR code. They can reach this computer when you start `mdeck run slides.md --network`. The poll example shows scales, word clouds and open questions.
:::

---
:::meta
layout: chapter
number: 4
part: Sharing
description: One file to send, a PDF, or a folder for a website.
:::
# Share it.

---
:::meta
layout: split
:::
# Change the whole look
:::slot left
```markdown
---
theme: work
palette: lagoon
---
```
:::
:::slot right
Two lines at the top of the file choose the theme and colours for every slide at once.

To try them without changing the file, open the **reader view** and choose **Look**.
:::

:::notes
mdeck has four built-in themes and five palettes, each light or dark. `mdeck list` shows them all, including any kept in an `extensions` folder beside the deck. `mdeck themes search` finds more in the theme repository.
:::

---
:::meta
layout: split
:::
# Send it, print it, host it
:::slot left
```sh
mdeck send slides.md
mdeck pdf slides.md
mdeck build slides.md
```
:::
:::slot right
`send` makes one HTML file without your notes, with a PDF inside. People open it in a browser.

`pdf` makes one page per slide. `build` makes a folder for a web server.
:::

---
:::meta
layout: title
:::
# Now make your own.
## Hand your slides, documents or notes to an *AI assistant*.

:::notes
`mdeck skill --install claude` (or codex, cursor, copilot, gemini) installs the `write-slides` skill, which teaches the assistant mdeck. Then point it at your material: “Rebuild lecture-03.pptx as a 20-minute talk.”

Without an assistant, `mdeck new` asks a few questions and starts a deck.
:::
