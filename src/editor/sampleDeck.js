// The sample deck: every built-in layout and kind of content, once, in
// ordinary amounts. The design page previews themes and palettes on it, and
// `npm run test:themes` checks every theme against it.

// A drawing in the palette's colours (with plain colours elsewhere): a chart
// over hills under a sun, for every layout that shows a picture.
export const SAMPLE_PICTURE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><rect width="800" height="500" fill="var(--surface, #eef1f4)"/><g stroke="var(--rule, #d5dbe1)" stroke-width="2"><path d="M0 100H800M0 200H800M0 300H800M0 400H800M100 0V500M200 0V500M300 0V500M400 0V500M500 0V500M600 0V500M700 0V500"/></g><circle cx="580" cy="165" r="128" fill="none" stroke="var(--accent, #3d5a73)" stroke-width="4" opacity="0.35"/><circle cx="580" cy="165" r="88" fill="var(--accent, #3d5a73)"/><path d="M0 360C140 292 262 300 384 338S628 424 800 330V500H0Z" fill="var(--accent-2, #c2410c)"/><path d="M0 418C168 366 330 392 470 422S690 474 800 434V500H0Z" fill="var(--accent, #3d5a73)" opacity="0.6"/><polyline points="80,262 170,214 260,236 350,170 440,196" fill="none" stroke="var(--ink, #1b2733)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><g fill="var(--bg, #ffffff)" stroke="var(--ink, #1b2733)" stroke-width="5"><circle cx="80" cy="262" r="10"/><circle cx="170" cy="214" r="10"/><circle cx="260" cy="236" r="10"/><circle cx="350" cy="170" r="10"/><circle cx="440" cy="196" r="10"/></g></svg>'

// The references the sample deck cites. Builds find them in a file beside the
// deck; the dev and edit servers read them from here where there is none.
export const SAMPLE_REFERENCES_FILE = 'sample-references.bib'
export const SAMPLE_REFERENCES = `@article{doe2024,
  author  = {Doe, Jane and Roe, Richard},
  title   = {Measuring how slides are read},
  journal = {Journal of Sample Studies},
  year    = {2024},
  volume  = {12},
  pages   = {1--10}
}

@book{roe2023,
  author    = {Roe, Richard},
  title     = {Quotations and Their Sources},
  publisher = {Example Press},
  year      = {2023}
}
`

// `picture` is where the slides find the picture: a file beside the deck, or
// a data URL where there is no such file.
export function sampleDeck(picture = './picture.svg') {
  return `---
meta:
  title: "Sample talk"
  author: "A. Author"
  organization: "Institute"
  date: "2026-10-06"
bibliography: ${SAMPLE_REFERENCES_FILE}
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

1. A step with *emphasis* and **strong** words
2. A step with \`inline code\` and a [link](https://example.com)
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

The difference is $\\Delta = 0.9$ [@doe2024, p. 4], with a footnote.[^1]

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

> A quotation set apart from the text.

As @roe2023 notes, a quote needs its source.
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

---
# References

<bibliography />
`.replaceAll('./picture.svg', picture)
}

// The picture as a data URL, for a sample deck that has no folder of its own.
export function sampleDataUrl() {
  return `data:image/svg+xml,${encodeURIComponent(SAMPLE_PICTURE)}`
}
