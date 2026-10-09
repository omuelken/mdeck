---
theme: neue
meta:
  title: "A short tour of mdeck"
show:
  organization: none
  author: none
bibliography: references.bib
---
:::meta
layout: title
image: ./mdeck.svg
fit: contain
alt: "A Markdown file turning into a stack of slides"
id: hello
:::
# Slides from a text file.
## A short tour of mdeck

:::notes
These notes are only for you: they show in the presenter view.
:::

---
:::meta
id: how-it-works
:::
# From your material to a talk

:::steps
- Hand your slides, papers or notes to an AI assistant
- It writes one Markdown file with your content
- mdeck presents it in the browser
- Send it as one file, or as a PDF
:::

:::notes
Press Next: the points appear one at a time.
:::

---
:::meta
layout: split
props:
  ratio: [1, 1]
id: write-this
:::
# Write this, get a slide

:::slot left
```markdown
# Three ideas

- Start small
- Show an example
- Ask a question
```
:::

:::slot right
A `#` makes the heading, a dash a point, and `---` starts the next slide. Your assistant writes it; you can read and change every word.
:::

---
:::meta
layout: focus
:::
# Your talk is a text file: you can read it, change it and keep it.

---

:::meta
layout: chapter
number: 1
part: "In the room"
:::
# Present it, live.

Draw, ask the room, cite and run code, right on the slides.

---
:::meta
layout: image-text
image: ./chart.svg
alt: "A bar chart with one bar much taller than the others"
id: draw
:::
# Draw while you talk

- Circle, underline, point with a laser
- From an iPad paired with the laptop
- Saved with the slide, also in the PDF

:::notes
The circle and the arrow were drawn on this slide and stay with it.
:::

---
:::meta
id: first
:::
# Which will you try first?

<poll room="first" options="Drawing on slides|Polls from phones|Citations|A new theme" />

:::notes
People answer on their phones and the bars grow live. These answers are kept from a talk.
:::

---
:::meta
id: cite
:::
# Cite like in a paper

Slides are Markdown, a plain text format meant to read well as it is [@gruber2004]. Text and code kept together is an old idea [@knuth1984].

Citations use Pandoc's syntax [@pandoc] and any citation style; each slide lists its references at its foot.

---
:::meta
id: references
:::
# References

<bibliography />

---
:::meta
id: run
:::
# Run code on the slide

```python live editable
features = ["drawing", "polls", "citations", "themes"]
print(", ".join(name.capitalize() for name in features))
```

:::tip
Press Run, change the list, run it again.
:::

---
:::meta
layout: chapter
number: 2
part: "The look"
:::
# Content and style, apart.

The file holds what you say. A theme decides how it looks.

---
:::meta
layout: split
props:
  ratio: [1, 1]
:::
# One file, many looks

:::slot left
## Themes
Six come with mdeck, more are one command away. Try the pictures below this deck.
:::

:::slot right
## Light or dark
Every palette has both. Switch while presenting, without touching the file.
:::

---
:::meta
layout: full-bleed-image
image: ./contours.jpg
alt: "Contour lines like those on a map"
overlay: true
:::
# Make your next presentation.
