---
design: aurora
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
image: ./img/image.jpg
note: |
  Welcome everyone. Today I'll walk through the slide framework.

  - **Content** in plain Markdown — readable, diffable, version-controllable
  - **Design** via swappable theme CSS — no per-slide formatting
  - **Components** in Preact — live code, syntax highlighting, math

  The pitch: *write your talk once, change the design system, the whole deck repaints.*
---
# A clean presentation framework.
## Markdown-driven slides with *swappable* design systems.

---
layout: chapter
number: 1
part: Part One
description: How content, design, and components fit together.
note: |
  Three independently replaceable layers:

  1. **Content** — Markdown frontmatter + body, parsed at build time
  2. **Design** — theme `tokens.css` + `templates.css`, zero JS
  3. **Behaviour** — Preact components registered in `registry.jsx`

  *Changing any one layer doesn't touch the others.*
---
# The three-part architecture.

---
layout: focus
eyebrow: Core principle
attribution: Tilman Schieber
note: |
  This is the central design decision. Pause here — it's the thesis of the whole framework.

  - **Content** is readable without tooling. A `.md` file is the source of truth.
  - **Design** is a CSS file. Designers can own it entirely.
  - **Behaviour** is isolated — themes never import component code.

  Ask: *"what breaks if you swap the theme?"* — the answer should be *nothing*.
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
section: Components
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
section: Components
note: |
  Flags on the fenced code block:

  - **`live`** — adds a Run button, captures `console.log` output below
  - **`editable`** — overlays a transparent textarea so attendees can type
  - **`copy`** — adds a clipboard button

  *Python uses Pyodide (loads on first run, ~10 MB). JS runs instantly in a sandboxed `Function`.*
---

```js live copy editable
const fib = n => n < 2 ? n : fib(n - 1) + fib(n - 2)
console.log(Array.from({ length: 10 }, (_, i) => fib(i)))
```

---
layout: focus
eyebrow: Python — live
section: Components
---

```python live copy
squares = [x**2 for x in range(1, 11)]
print(squares)
print(f"Sum: {sum(squares)}")
```

---
layout: focus
eyebrow: Tables
section: Components
note: |
  Standard GFM table syntax — pipes and dashes. No special component needed.
  The header row gets a bold 2px bottom border using --ink; body rows use --rule.
  Themes can override the sizing and weight (FHNW uses uppercase headers at fs-small).
---

| Layer   | Format     | Who owns it  |
|---------|------------|--------------|
| Content | Markdown   | Author       |
| Design  | CSS        | Designer     |
| Behaviour | Preact   | Developer    |

---
layout: focus
eyebrow: Callouts
section: Components
note: |
  GitHub-style alert syntax via marked-alert. Five types: NOTE, TIP, IMPORTANT, WARNING, CAUTION.
  Each gets a coloured left border and title. Background uses --surface so dark palettes adapt automatically.
---

::: note
Use callouts sparingly — one per slide at most.
:::

::: tip Combine with code
Place next to a code block on a split layout for step-by-step instructions.
:::

::: warning
Callouts interrupt reading flow. Reserve them for genuinely critical information.
:::

---
section: Mathematics
---
# Inline and block math.

The quadratic formula $x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$ works inline.

$$
\int_0^\infty e^{-x^2}\,dx = \frac{\sqrt{\pi}}{2}
$$

---
layout: chapter
number: 2
part: Part Two
image: ./img/image.jpg
description: Layouts, live components, and everything beyond the basics.
---
# Advanced layouts and components.

---
section: Content
---
# Three key principles

1. **Simplicity** — one idea per slide, one slide per idea
2. **Contrast** — keep content, design, and behaviour in separate layers
3. **Rhythm** — consistent spacing and typography throughout the deck

---
layout: split
section: Custom Layouts
---
<codeblock lang="js">
function parseSlides(markdown) {
  const segments = markdown.split(/^---$/m)
  return segments.map(s => yaml.load(s.trim()))
}
</codeblock>

# Split layout.
The first block — any component, image, or paragraph — goes left. Everything else flows to the right automatically.

---
layout: four-columns
section: Custom Layouts
---
# Four pillars

<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 48px; margin-top: 40px;">
  <div>
    <strong style="display: block; margin-bottom: 12px;">Speed</strong>
    Process thousands of records per second with zero configuration.
  </div>
  <div>
    <strong style="display: block; margin-bottom: 12px;">Cost</strong>
    Linear pricing with no per-seat fees or hidden platform charges.
  </div>
  <div>
    <strong style="display: block; margin-bottom: 12px;">Quality</strong>
    Validated against fifty thousand test cases before every release.
  </div>
  <div>
    <strong style="display: block; margin-bottom: 12px;">Scale</strong>
    Distributed across any number of nodes without rewriting your code.
  </div>
</div>

---
layout: focus
eyebrow: Example component
section: Components
---
# QR Code component.

<qrcode url="https://gitlab.fhnw.ch/tilman.schieber/mdeck" size="380" />
