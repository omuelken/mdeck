---
theme: neue
meta:
  title: "A tour of mdeck"
  author: "Tilman Schieber"
  organization: "FHNW"
  date: "2026-10-06"
bibliography: refs.bib
reactions: true
---

---
:::meta
layout: title
image: ./img/mdeck.svg
fit: contain
alt: "A Markdown file turning into a stack of slides"
id: a-talk-in-a-text-file
time: 1m
:::
# A talk in a text file.
## A tour of mdeck: each slide shows *what is written* and what it becomes.

:::notes
This deck teaches mdeck by example. Most slides show the Markdown beside what it becomes. Open `slides.en.md` next to it: every slide here is written exactly as shown.

Go through it with the arrow keys or the space bar. These notes are only for you; open the presenter view from the launch page to see them beside the slide.

The tour also comes in German (`slides.de.md`) and Arabic (`slides.ar.md`). Start it with `mdeck run slides.en.md`, and **L** in the presenter view switches every window to the next language.
:::

---
:::meta
layout: chapter
number: 1
part: Writing
description: Plain Markdown, the format AI assistants already write. You can read and change every word.
time: 15s
:::
# Write it.

:::notes
In practice an AI assistant usually writes this file from your own material: old slides, a document, your notes. The `write-slides` skill teaches it mdeck. The next slides show what it writes, so you can read and adjust it.
:::

---
:::meta
layout: split
time: 1m
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

Try it: change a heading in `slides.en.md` and save. The slide updates while it is open.
:::

---
:::meta
layout: split
time: 45s
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
time: 1m
:::
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
time: 15s
:::
# Lay it out.

---
:::meta
layout: split
props:
  ratio: [3, 2]
time: 1m
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
time: 30s
:::
# Good questions make better conversations.

---
:::meta
layout: image-text
image: ./img/image.jpg
alt: "Contour lines like those on a map"
time: 45s
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
time: 30s
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
time: 1m30s
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
time: 45s
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
time: 45s
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
layout: split
time: 1m
:::
# Cite your sources
:::slot left
```markdown
---
bibliography: refs.bib
---

Recalling beats rereading
[@roediger2006].
```
:::
:::slot right
Recalling beats rereading [@roediger2006].

Lectures with active learning cut failure rates by a third [@freeman2014].
:::

:::notes
`refs.bib` is a BibTeX file, as Zotero exports it; CSL-JSON and Hayagriva work too. Each slide lists its own references above the footer, and `<bibliography />` on a slide lists them all. `csl: vancouver` switches to numbers.
:::

---
:::meta
layout: chapter
number: 3
part: Presenting
description: Notes for you, drawing on the slides, and questions for the room.
id: give-the-talk
time: 15s
:::
# Give the talk.

---
:::meta
layout: split
time: 1m
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
time: 1m
:::
# Draw on any slide

Press **D** now, or the pen button. Draw with a pen, a highlighter, or a marker that fades after a moment. **Escape** stops.

Drawings are kept in a `.drawings.json` file beside the slides, and appear in the PDF.

:::notes
The underline and the circle on this slide were drawn with the pen and saved; they show in every view and in the PDF.

On an iPad, pair it from the launch page: you draw and steer there while the laptop drives the projector.
:::

---
:::meta
layout: split
hotspots: auto
id: zoom-in-on-a-part
time: 1m30s
:::
# Zoom in on a part
:::slot left
```markdown
:::meta
hotspots: auto
:::
```

In the presenter view, press a **number** to zoom into that part. The same number, **0** or **Escape** goes back.
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
The numbered keys show on this slide only here in the presenter view, never on the projector. Press 2 for the table, 3 for the formula; the audience window flies along. The arrow keys leave the zoom and move on in one press.

`hotspots: auto` finds pictures, code, tables, formulas and callouts. Put it in the deck's settings at the top to have keys on every slide, or write `marked` to give keys only to parts marked `data-hotspot`. H switches the keys off and on during the talk.
:::

---
:::meta
layout: split
time: 1m
:::
# Time your talk
:::slot left
```markdown
:::meta
time: 1m
:::
```
:::
:::slot right
Give each slide a **time**. The presenter view counts it down, and tells you whether you are ahead or behind.

Run `mdeck rehearse slides.md` to time the slides as you practise, then save the times into the file.
:::

:::notes
Every slide in this tour has a time, 21 minutes in all. Press T in the presenter view to start the timer: under it you see what is left of this slide and how the talk stands.

A rehearsal measures the times for you. At the end it offers them rounded to 15 seconds; change any of them before you save.
:::

---
:::meta
time: 1m30s
:::
# Which part will you try first?

<poll room="tour" options="Writing|Layouts|Drawing|Polls" />

:::notes
One line makes a poll; the heading is the question:

`<poll room="tour" options="Writing|Layouts|Drawing|Polls" />`

Press **J** to show the join code over the slide; phones scan it and stay in for every question after. They can reach this computer when you start `mdeck run slides.md --network`.
:::

---
:::meta
layout: split
time: 1m
:::
# One word from everyone
:::slot left
```markdown
<wordcloud room="mood" />

<scale room="pace" min="1" max="5"
  low="Too slow" high="Too fast" />

<question room="ask" />
```
:::
:::slot right
<wordcloud room="mood" placeholder="One word" />
:::

:::notes
Phones that joined at the poll stay in; **J** shows the join code again for latecomers. Answers appear as they come in. This tour sets `reactions: true`, so the phones also have 👍 👏 ❤️ 😮 🤔 buttons: taps float up in your presenter view, never on the projector.

Besides polls and word clouds there are ratings (`<scale>`), numbers with a right answer (`<numeric>`) and open questions (`<question>`). With several of them, `<qrcode join />` on an early slide shows the code once. `mdeck run` keeps the answers in `slides.results.json` beside the deck.
:::

---
:::meta
layout: chapter
number: 4
part: Sharing
description: One file to send, a PDF, or a folder for a website.
time: 15s
:::
# Share it.

---
:::meta
layout: split
time: 45s
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
time: 45s
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
time: 1m
:::
# Now make your own.
## Hand your slides, documents or notes to an *AI assistant*.

:::notes
`mdeck skill --install claude` (or codex, cursor, copilot, gemini) installs the `write-slides` skill, which teaches the assistant mdeck. Then point it at your material: “Rebuild lecture-03.pptx as a 20-minute talk.”

Without an assistant, `mdeck new` asks a few questions and starts a deck.
:::
