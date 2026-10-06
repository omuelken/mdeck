---
theme: aurora
meta:
  title: "A tour of mdeck"
  author: "Tilman Schieber"
  organization: "FHNW"
  date: "2026-10-06"
  logo: ./img/logo.png
---

---
:::meta
layout: title
image: ./img/image.jpg
alt: "Contour lines like those on a map"
:::
# A talk in a text file.
## A tour of mdeck: each slide shows *what you write* and what you get.

:::notes
This deck teaches mdeck by example. Most slides show the Markdown on the left and what it becomes on the right.

Go through it with the arrow keys or the space bar. Open `slides.md` beside it: every slide here is written exactly as shown.

These notes are only for you. Open the presenter view from the launch page to see them beside the slide.
:::

---
:::meta
layout: split
section: Writing
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
section: Writing
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
:::meta
layout: split
section: Writing
:::
# Reveal points one at a time
:::slot left
```markdown
:::steps
- First, a question.
- Then, a pause.
- Then, the answer.
:::
```
:::
:::slot right
:::steps
- First, a question.
- Then, a pause.
- Then, the answer.
:::
:::

:::notes
Press the next key: each press reveals one point, then moves on. Printed slides and the PDF show all the points.
:::

---
:::meta
layout: split
section: Layouts
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

Others: `title`, `chapter`, `split`, `image-text`, `full-bleed-image`.
:::

:::notes
Without a layout, a slide is an ordinary heading with content. This slide is `layout: split`, with the two sides written as `:::slot left` and `:::slot right`.
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
section: Layouts
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

Keep pictures in a folder beside the slides. `alt` describes the picture for people who cannot see it.

---
:::meta
layout: split
section: Content
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
section: Content
:::
# Tables and formulas
:::slot left
```markdown
| Layer | Who owns it |
|---|---|
| Words | You |
| Look | The theme |

$A = \pi r^2$
```
:::
:::slot right
| Layer | Who owns it |
|---|---|
| Words | You |
| Look | The theme |

$A = \pi r^2$
:::

:::notes
Formulas use LaTeX between dollar signs. Two dollar signs above and below put a formula on its own line.
:::

---
:::meta
layout: split
section: Content
:::
# Tips and columns
:::slot left
```markdown
:::tip
One tip per slide is plenty.
:::

:::columns
**Before** the talk
+++
**After** the talk
:::
```
:::
:::slot right
:::tip
One tip per slide is plenty.
:::

:::columns
**Before** the talk
+++
**After** the talk
:::
:::

:::notes
The other callouts are `note`, `important`, `warning` and `caution`. `+++` starts the next column.
:::

---
:::meta
layout: chapter
number: 2
part: Presenting
description: Notes, drawing and questions for the room.
:::
# Give the talk.

---
:::meta
layout: split
section: Presenting
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
section: Presenting
id: draw-on-any-slide
:::
# Draw on any slide

Press **D** now, or the pen button. Draw with a pen, a highlighter, or a marker that fades after a moment. **Escape** stops.

Drawings are kept in `slides.drawings.json` beside the slides, and appear in the PDF.

:::notes
On an iPad, pair it from the launch page: you draw and steer there while the laptop drives the projector.
:::

---
:::meta
section: Presenting
:::
# Which part will you try first?

<poll room="tour" options="Writing|Layouts|Drawing|Polls" />

:::notes
One line makes a poll; the heading is the question:

`<poll room="tour" options="Writing|Layouts|Drawing|Polls" />`

Phones join with the QR code. They can reach this computer when you start `mdeck run slides.md --network`. The poll example shows scales, word clouds and open questions.
:::

---
:::meta
layout: split
section: Sharing
:::
# Change the whole look
:::slot left
```markdown
---
theme: neue
palette: paper
---
```
:::
:::slot right
The settings at the top of the file choose the theme and colours for every slide at once.

To try them without changing the file, open the **reader view** and choose **Look**.
:::

---
:::meta
layout: split
section: Sharing
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
layout: focus
:::
# Now write your own.

`mdeck new` asks a few questions and starts a deck for you.
