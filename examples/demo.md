---
design: modern
params:
  primaryColor: "#0A0A0A"
meta:
  title: "Slide Framework Demo"
  author: "Tilman Schieber"
  organization: "FHNW"
  date: "2026-05-13"
width: 1920
height: 1080
---
---
layout: title
---
# A clean presentation framework.
## Markdown-driven slides with swappable design systems.

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
# Separate content from design from behaviour.

---
layout: image-text
section: Design System
---
## Tokens all the way down.

Change `primaryColor` in the deck frontmatter and the whole deck repaints. Each design system declares its own configurable params mapped to CSS custom properties.

---
layout: bullet-list
section: Components
---
## Built-in component types

- `<codeblock>` — syntax-highlighted code via Prism
- Add `<animation>` or `<iframe>` by creating a component and registering it in `src/registry.jsx`
- Components are styled by the design system but have neutral defaults

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
layout: full-bleed-image
overlay: true
---
# Design systems are swappable — just change `design:` in the frontmatter.
