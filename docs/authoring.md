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

Some body text here. No frontmatter needed for plain content slides.
```

Each `---` line starts a new slide. Frontmatter is only needed when you want a specific layout or slide metadata (`section`, `note`, `image`, etc.). Plain content slides can follow the `---` separator directly with their markdown content.

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
| `sections` | `all` | Whether to show section labels in the header: `all` or `none` |
| `lang` | `en` | Language for built-in labels such as callout titles: `en` or `de` |
| `callouts` | — | Override individual callout titles (see below) |
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
| `duet` | Two-accent system — Syne display, DM Sans body, structure vs. voice color roles |
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

Each slide can have its own frontmatter block immediately after the `---` separator. Frontmatter is only needed when a slide has specific metadata — layout, image, explicit section label, etc. Plain content slides can omit it entirely.

```markdown
---
layout: chapter
number: 1
part: Part One
description: A short description shown under the title.
---
# Chapter title.
```

### Common slide fields

| Field | Description |
|---|---|
| `layout` | Slide layout (see below) |
| `section` | Section label shown in the slide header (auto-propagated — see below) |

### Section labels

The `section:` field labels the top-right corner of the slide header. It auto-propagates: once set on a slide, all subsequent slides inherit it until a new `section:` is declared or a new chapter starts.

`chapter` slides automatically set the current section to their `part:` value, so slides within a chapter inherit the chapter name without needing explicit `section:` fields.

```markdown
---
layout: chapter
number: 1
part: Methodology
---
# Chapter title.

---
# First slide.
This slide automatically shows "Methodology" in the header.

---
section: Results
---
# Second slide.
This slide shows "Results" — and so does every slide after it until the next chapter or section override.
```

### Speaker notes

Speaker notes are only visible in the presenter view. Use a `:::notes` fenced block anywhere in the slide body — typically at the end:

```markdown
---
layout: focus
eyebrow: Key point
---
# The main statement.

:::notes
This is the central idea. Pause here.

- Bullet one
- Bullet two
:::
```

Notes support full Markdown. They replace the older `note:` frontmatter key, which still works but is less readable for multiline content.

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

No `layout:` field renders a standard content slide. `h1` is the heading; everything below is body content. Frontmatter is optional — omit it entirely for slides that need no metadata:

```markdown
---
# Three key principles

1. **Simplicity** — one idea per slide
2. **Contrast** — separate layers
3. **Rhythm** — consistent spacing
```

Add frontmatter only when you need slide-level metadata:

```markdown
---
section: Content
note: Speaker notes go here.
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

### Callout titles

Without a custom title, a callout is labelled after its type. Set `lang: de` in the deck frontmatter to get German defaults (`Hinweis`, `Tipp`, `Wichtig`, `Achtung`, `Vorsicht`), or override individual titles:

```yaml
lang: de
callouts:
  warning: "Vorsicht, Falle"
```

A title written after the type on the `:::` line still wins over both.

---

## Speaker notes

Use a `:::notes` fenced block in the slide body. Notes support Markdown and are only visible in the presenter view:

```markdown
---
layout: focus
eyebrow: Key point
---
# The main idea.

:::notes
This is the central design decision. Pause here.

- **Content** is readable without tooling
- **Design** is just a CSS file
- Ask: *"what breaks if you swap the theme?"*
:::
```

The `:::notes` block can appear anywhere in the body, but placing it last keeps it visually separate from slide content. The older `note:` frontmatter key is also supported.

---

## Columns

Place content side by side using `:::columns` with `+++` as the column separator:

```markdown
:::columns

Left column content here.

+++

Right column content here.

+++

A third column, if needed.

:::
```

Each column is an equal-width flex child, so three `+++` separators give four equal columns. Use `:::columns` inside any layout that has a body area — `GenericSlide`, `focus`, etc.

---

## Images

Reference images with standard Markdown syntax or the `image:` frontmatter field. Paths are relative to the deck file.

```markdown
![Alt text](./img/diagram.png)
```

For a fully self-contained output file, build with inline images:

```bash
mdeck build slides.md --inline-images
```

This inlines local Markdown images, `<img src="...">`, and frontmatter `image:` / `logo:` values as data URLs.

A normal build copies referenced local images, video, and audio next to the HTML
while preserving their deck-relative paths. This is the recommended distribution
format for decks containing substantial video.

To embed all local images and media in a single offline-ready HTML file, use:

```bash
mdeck build slides.md --self-contained -o slides.html
```

Theme web fonts are replaced by their declared system-font fallbacks in this mode.
Self-contained video is base64-encoded and is therefore roughly 33% larger than
the source file; loading, memory use, and seeking can also be worse than with a
separate media file.

To add target-computer launchers to a directory bundle, build with
`--presenter-launchers`. The generated `present.sh` (macOS/Linux),
`present.bat`, and `present.ps1` (Windows) require Python 3, start a local server
bound to `127.0.0.1`, and open the presenter view in the default browser.

---

## Video

Embed video with the `<videoplayer>` component. It accepts local files and web video URLs.

```markdown
<!-- Local file — click to play (default) -->
<videoplayer src="./demo.mp4" />

<!-- Autoplay when slide becomes active (muted, as required by browsers) -->
<videoplayer src="./demo.mp4" play="auto" />

<!-- YouTube, Vimeo, or SwitchTube URL -->
<videoplayer url="https://youtu.be/dQw4w9WgXcQ" />
<videoplayer url="https://tube.switch.ch/videos/abc123" play="auto" />
```

| Attribute | Default | Description |
|---|---|---|
| `src` | — | Path to a local video file |
| `url` | — | Web video URL (YouTube, Vimeo, SwitchTube, or direct embed URL) |
| `play` | `click` | `click` — user controls playback; `auto` — plays when slide activates, pauses when leaving |
| `aspect` | `16/9` | CSS `aspect-ratio` value, e.g. `4/3` |
| `muted` | — | Mute the video (always muted in `auto` mode) |

For `play="auto"` the video pauses and resets to the beginning when you navigate away. Local videos also pause automatically on slide leave in `click` mode to avoid unexpected audio.

---

## Deck-local components

Components registered in `src/registry.jsx` are part of *every* deck. When a
widget is only needed by one talk, put it in a `components/` folder next to the
deck file instead:

```
my-talk/
  my-talk.md
  components/
    Tokenizer.jsx
```

Each `*.jsx` file's default export is registered automatically under its
lowercased filename, so `Tokenizer.jsx` becomes `<tokenizer>`:

```markdown
<tokenizer text="Donaudampfschifffahrt" />
```

Attributes arrive as props, exactly like built-in components. Deck-local
components override a built-in of the same name.

Because they are only pulled in by the deck that ships them, a heavy dependency
stays out of every other deck's bundle. Install such dependencies in a
`node_modules` next to the deck, or in the framework itself.

> Deck components are `.jsx` only, and are written against Preact — import
> hooks from `preact/hooks`. The build resolves those imports back to the
> framework's own Preact, so the deck folder needs no Preact install.

---

## Inline HTML

You can write HTML directly in slide bodies. It inherits the theme's body text styles automatically. Use it for structural layouts the framework doesn't provide out of the box:

```markdown
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 48px;">
  <div>Left column content</div>
  <div>Right column content</div>
</div>
```
