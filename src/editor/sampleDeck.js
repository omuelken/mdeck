// The sample deck: every built-in layout and kind of content, once, in
// ordinary amounts. The design page previews themes and palettes on it, and
// `npm run test:themes` checks every theme against it.

export const SAMPLE_PICTURE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#6b7f99"/><circle cx="140" cy="150" r="80" fill="#e0c068"/><rect x="220" y="80" width="120" height="140" fill="#2d3e50"/></svg>'

// `picture` is where the slides find the picture: a file beside the deck, or
// a data URL where there is no such file.
export function sampleDeck(picture = './picture.svg') {
  return `---
meta:
  title: "Sample talk"
  author: "A. Author"
  organization: "Institute"
  date: "2026-10-06"
---

---
layout: title
---
# A talk about *trying* themes.
## Every layout and every kind of content, once.

---
layout: title
image: ./picture.svg
alt: "Shapes"
---
# A title with a picture.
## And a subtitle beside it.

---
layout: chapter
number: 2
part: Methods
---
# How it was *measured*

One sentence about what this chapter covers.

---
layout: chapter
number: 3
image: ./picture.svg
alt: "Shapes"
---
# A chapter with a picture

---
# Lists, emphasis and code

- A point with *emphasis* and **strong** words
- A second point with \`inline code\`
  - A nested point
  - Another nested point

\`\`\`js
const total = values.reduce((sum, value) => sum + value, 0)
\`\`\`

---
# Numbers in a table

| Group | Mean | Spread |
|---|---|---|
| Control | 4.2 | 0.8 |
| Treatment | 5.1 | 0.6 |
| Follow-up | 5.0 | 0.7 |

The difference is $\\Delta = 0.9$, with a footnote.[^1]

[^1]: A source for the claim.

---
# Callouts

::: tip
A tip in one sentence.
:::

::: warning
A warning in one sentence.
:::

::: note Your own title
A note with a title of its own.
:::

---
# Blocks for lectures

::: definition Definition 1 (Group)
A set with an associative operation, a neutral element and inverses.
:::

::: theorem Theorem 2 (Lagrange)
The order of a subgroup divides the order of the group.
:::

::: proof
The cosets partition the group into parts of equal size.
:::

---
# Two columns

:::columns
Some text on the left, with a formula:

$$
\\int_0^1 x^2 \\, dx = \\frac{1}{3}
$$

+++

1. First step
2. Second step
3. Third step
:::

---
layout: focus
eyebrow: Key point
attribution: "Someone wise"
---
# A statement that takes a line or two on the slide.

---
layout: image-text
image: ./picture.svg
alt: "Shapes"
---
# A picture beside words

Two sentences of text beside the picture. They explain what it shows.

---
layout: split
---
# A split slide
:::slot left
\`\`\`python
def mean(values):
    return sum(values) / len(values)
\`\`\`
:::
:::slot right
- What the code does
- Why it matters
:::

---
layout: full-bleed-image
image: ./picture.svg
alt: "Shapes"
overlay: true
---
# A picture that fills the slide.
`.replaceAll('./picture.svg', picture)
}

// The picture as a data URL, for a sample deck that has no folder of its own.
export function sampleDataUrl() {
  return `data:image/svg+xml,${encodeURIComponent(SAMPLE_PICTURE)}`
}
