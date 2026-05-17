---
design: clarity
palette: default
meta:
  title: "Slide Framework Demo"
  author: "Tilman Schieber"
  organization: "FHNW"
  date: "2026-05-13"
  logo: ./img/logo.png
width: 1920
height: 1080
---
---
layout: title
note: |
  Welcome everyone. Today I'll walk you through the slide framework — how it's structured, what it can do, and why we built it this way.
  
  The core idea: write your talk in plain Markdown, pick a design system, and the framework handles the rest. No PowerPoint, no Keynote lock-in.
---
# A clean presentation framework.
## Markdown-driven slides with *swappable* design systems.

---
layout: chapter
number: 1
part: Part One
description: How content, design, and components fit together.
note: "Three layers: (1) content in Markdown, (2) design via theme CSS + tokens, (3) interactive components in Preact. Each layer is independently replaceable."
---
# The three-part architecture.

---
layout: focus
eyebrow: Core principle
attribution: Tilman Schieber
note: |
  This is the central design decision. Content lives in Markdown — it's readable, diffable, version-controllable.
  
  Design lives in CSS tokens — swap the theme file and every slide repaints instantly.
  
  Behaviour (interactive components, live code) is isolated in Preact components that the theme never touches.
---
# Separate *content* from *design* from behaviour.

---
layout: image-text
section: Design System
image: ./img/image.jpg
note: "The footnote on this slide demonstrates the footnote system — definitions in the frontmatter are extracted, numbered automatically, and rendered as a small block above the footer."
---
## Tokens all the way down.

Change `primaryColor` in the deck frontmatter and the *whole deck* repaints.[^1] Each design system declares its own configurable params mapped to CSS custom properties.

[^1]: Palette overrides are injected as a `:root {}` block after the theme CSS, so they win by document order.

---
layout: bullet-list
section: Components
note: "Register custom components in src/registry.jsx. The component receives all HTML attributes as props — so <codeblock lang='js'> gives you { lang: 'js' } in Preact. Keep component styling in the theme so swapping themes still works."
---
# Built-in component types

- `<codeblock>` — syntax-highlighted code via Prism
- Add `<animation>` or `<iframe>` by creating a component and registering it in `src/registry.jsx`
- Components are styled by the design system but have *neutral defaults*

---
layout: focus
eyebrow: Example component
---
# Code with syntax highlighting.

<codeblock lang="js">
function parseSlides(markdown) {
  const segments = markdown.split(/^---$/m)
  return segments.map(s => yaml.load(s.trim()))
}
</codeblock>

---
layout: focus
eyebrow: JavaScript — live & editable
note: "Live + editable: attendees can modify the code directly in the slide. 'copy' adds a clipboard button. The code runs in the browser — no server needed. Pyodide powers Python execution."
---

```js live copy editable
const fib = n => n < 2 ? n : fib(n - 1) + fib(n - 2)
console.log(Array.from({ length: 10 }, (_, i) => fib(i)))
```

---
layout: focus
eyebrow: Python — live
---

```python live copy
squares = [x**2 for x in range(1, 11)]
print(squares)
print(f"Sum: {sum(squares)}")
```

---
section: Mathematics
---
# Inline and block math.

The quadratic formula $x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$ works inline.

$$
\int_0^\infty e^{-x^2}\,dx = \frac{\sqrt{\pi}}{2}
$$

---
layout: full-bleed-image
image: ./img/image.jpg
---
# Design systems are swappable — just change `design:` in the frontmatter.
