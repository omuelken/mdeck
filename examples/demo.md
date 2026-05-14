---
design: modern
palette: noir 
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
---
# A clean presentation framework.
## Markdown-driven slides with *swappable* design systems.

---
layout: chapter
number: 1
part: Part One
description: How content, design, and components fit together.
---
# The three-part architecture.

---
layout: focus
eyebrow: Core principle
attribution: Tilman Schieber
---
# Separate *content* from *design* from behaviour.

---
layout: image-text
section: Design System
image: ./img/image.jpg
---
## Tokens all the way down.

Change `primaryColor` in the deck frontmatter and the *whole deck* repaints. Each design system declares its own configurable params mapped to CSS custom properties.

---
layout: bullet-list
section: Components
---
## Built-in component types

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
