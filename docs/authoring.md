# Authoring slides

Decks are plain Markdown files. You can version them in git, open them in any text editor, and diff them like code.

---

## Deck structure

A deck is a single `.md` file. The first block is the **deck frontmatter** — it configures the whole presentation. Each subsequent `---` separator starts a new slide.

```markdown
---
design: neue
palette: paper
meta:
  title: "My Talk"
  author: "Jane Smith"
  organization: "Acme"
  date: "2026-05-19"
  logo: ./img/logo.png
width: 1920
height: 1080
---

---
layout: title
---
# First slide.
## A short subtitle.

---
# Second slide.

Some body text.
```

### Deck frontmatter fields

| Field | Default | Description |
|---|---|---|
| `design` | `neue` | Theme name |
| `palette` | _(theme default)_ | Color palette override |
| `accent` | _(theme/palette default)_ | Primary accent color override |
| `accent2` | _(theme/palette default)_ | Secondary accent color (Aurora theme) |
| `meta.title` | — | Deck title (shown in footer) |
| `meta.author` | — | Author name (shown in footer) |
| `meta.organization` | — | Organization name (shown in header) |
| `meta.date` | — | Date string (shown in footer) |
| `meta.logo` | — | Path to logo image |
| `width` / `height` | `1920` / `1080` | Slide canvas dimensions in px |
| `institution` | `title` | When to show the organization name: `title`, `all`, or `none` |
| `authorDate` | `title` | When to show the author/date footer: `title`, `all`, or `none` |
| `pageNumbers` | `slides` | Slide numbers: `slides` (all except title), `all`, or `none` |
| `params` | — | Theme-specific color/font overrides (see below) |

### Theme params

Some themes expose configurable tokens. Set them under `params:`:

```yaml
params:
  primaryColor: "#e63946"
  backgroundColor: "#fafafa"
```

Available params depend on the theme — check the presenter sidebar for a list.

---

## Available themes

| Key | Description |
|---|---|
| `neue` | Clean sans-serif — Inter Tight headlines, neutral defaults |
| `aurora` | Geometric modern — Plus Jakarta Sans, gradient accents |
| `editorial` | High-contrast serif — Playfair Display headlines, Lora body |
| `fhnw` | FHNW brand theme |
| `terminal` | Dark monospace — code-first presentations |

---

## Available palettes

| Key | Style |
|---|---|
| `paper` | Clean white |
| `sage` | Muted sage green |
| `mono` | Pure monochrome |
| `terra` | Warm sand and red |
| `dark-slate` | Dark cool blue |
| `dark-ember` | Dark warm amber |
| `dark-neon` | Dark vivid neon |
| `dark-mono` | Dark neutral grey |

---

## Slide frontmatter

Each slide can have its own frontmatter block immediately after the `---` separator:

```markdown
---
layout: chapter
number: 1
part: Part One
description: A short description shown under the title.
section: Section Name
note: |
  Speaker notes go here.
  Supports **markdown**.
---
# Chapter title.
```

### Common slide fields

| Field | Description |
|---|---|
| `layout` | Slide layout (see below) |
| `note` | Speaker notes — shown in presenter view, supports Markdown |
| `section` | Section label shown in the slide header |

---

## Layouts

### `title` — Opening slide

Centered headline and subtitle. The `h1` becomes the display headline; `h2` becomes the italic subtitle.

```markdown
---
layout: title
---
# A clean presentation framework.
## Markdown-driven slides with *swappable* design systems.
```

---

### `chapter` — Section divider

Ghost numeral, a short accent rule, chapter label, title, and optional description.

```markdown
---
layout: chapter
number: 1
part: Part One
description: How content, design, and components fit together.
---
# The three-part architecture.
```

| Field | Description |
|---|---|
| `number` | The large ghost numeral |
| `part` | Small uppercase label above the title |
| `description` | Italic description below the title |

---

### `focus` — Statement or quote

Left-aligned large statement with an optional eyebrow label and attribution line.

```markdown
---
layout: focus
eyebrow: Core principle
attribution: Tilman Schieber
---
# Separate *content* from *design* from behaviour.
```

| Field | Description |
|---|---|
| `eyebrow` | Small uppercase label above the statement |
| `attribution` | Small italic credit below |

---

### `image-text` — Image beside text

Left image pane, right text pane.

```markdown
---
layout: image-text
image: ./img/diagram.jpg
section: Architecture
---
## Tokens all the way down.

Change one value and the *whole deck* repaints.
```

| Field | Description |
|---|---|
| `image` | Path to image file |
| `section` | Header label |

---

### `full-bleed-image` — Photograph edge-to-edge

The `h1` appears as a caption over a dark gradient at the bottom of the image.

```markdown
---
layout: full-bleed-image
image: ./img/photo.jpg
---
# A caption over the photograph.
```

---

### `split` — Component beside text

The first block element in the body (any component, image, or paragraph) goes to the left pane; everything else flows to the right.

```markdown
---
layout: split
---
```js
const fib = n => n < 2 ? n : fib(n - 1) + fib(n - 2)
```

# Split layout.
The code block goes left. This heading and text go right.
```

---

### Generic (no layout) — Content slide

No `layout:` field renders a standard content slide. `h1` is the heading; everything below is body content.

```markdown
---
section: Content
---
# Three key principles

1. **Simplicity** — one idea per slide
2. **Contrast** — separate layers
3. **Rhythm** — consistent spacing
```

---

## Markdown elements

### Headings

`h1` is the slide heading. `h2` is a subheading. Avoid going deeper — slide typography is not designed for `h3`–`h6`.

### Emphasis

- `*italic*` or `_italic_` → italic, colored in the accent color
- `**bold**` or `__bold__` → bold, in the primary ink color

### Lists

Unordered lists render with a short accent rule as the bullet. Ordered lists use large ghost numerals.

```markdown
- First item
- Second item

1. First step
2. Second step
```

### Footnotes

Define footnotes inline. They render as a small block above the slide footer.

```markdown
This claim needs a source.[^1]

[^1]: The source citation goes here.
```

---

## Code blocks

Fenced code blocks are syntax-highlighted. Add flags after the language name for extra behavior:

````markdown
```js live editable copy
const fib = n => n < 2 ? n : fib(n - 1) + fib(n - 2)
console.log(fib(10))
```
````

| Flag | Effect |
|---|---|
| `live` | Adds a Run button; captures `console.log` output below the block |
| `editable` | Makes the block editable in-browser |
| `copy` | Adds a clipboard copy button |

Supported languages include `js`, `python`, `css`, `html`, `json`, `bash`, and any other Prism-supported language.

> Python requires Pyodide, which loads on first run (~10 MB). JavaScript runs instantly in a sandboxed `Function`.

---

## Tables

Standard GFM table syntax:

```markdown
| Layer     | Format   | Who owns it |
|-----------|----------|-------------|
| Content   | Markdown | Author      |
| Design    | CSS      | Designer    |
| Behaviour | Preact   | Developer   |
```

---

## Math

Inline math: `$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$`

Block math:

```markdown
$$
\int_0^\infty e^{-x^2}\,dx = \frac{\sqrt{\pi}}{2}
$$
```

---

## Callouts

Use `:::` fences with a type keyword. An optional custom title follows the type on the same line.

```markdown
::: note
Use callouts sparingly — one per slide at most.
:::

::: tip Combine with code
Place next to a code block for step-by-step instructions.
:::

::: warning
Callouts interrupt reading flow.
:::
```

Available types: `note`, `tip`, `important`, `warning`, `caution`.

---

## Speaker notes

Set `note:` in a slide's frontmatter. Notes support Markdown and are only visible in the presenter view — they never appear on the audience-facing slide.

```yaml
---
note: |
  This is the central design decision. Pause here.

  - **Content** is readable without tooling
  - **Design** is just a CSS file
  - Ask: *"what breaks if you swap the theme?"*
---
```

---

## Images

Reference images with standard Markdown syntax or the `image:` frontmatter field. Paths are relative to the deck file.

```markdown
![Alt text](./img/diagram.png)
```

---

## Inline HTML

You can write HTML directly in slide bodies. It inherits the theme's body text styles automatically. Use it for structural layouts the framework doesn't provide out of the box:

```markdown
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 48px;">
  <div>Left column content</div>
  <div>Right column content</div>
</div>
```
