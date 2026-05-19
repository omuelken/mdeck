# mdeck

A minimal Markdown-driven slide deck framework with swappable themes, palettes, and JSX components. Builds to a single self-contained HTML file.

## Quick start

```bash
npm install
npm link                          # install the mdeck command globally (once)

mdeck dev my-talk.md               # dev server with live reload
mdeck build my-talk.md             # build → dist/index.html
```

Without `npm link`, pass the file via npm scripts:

```bash
npm run dev -- my-talk.md
npm run build -- my-talk.md
```

---

## CLI

```
mdeck dev <slides.md>                  Start dev server with live reload
mdeck present <slides.md>              Open speaker/presenter view
mdeck build <slides.md> [-o out.html]  Build self-contained HTML
mdeck preview                          Preview the last build
mdeck --help                           Show usage
```

The `-o` flag builds to a specific file instead of `dist/index.html`:

```bash
mdeck build my-talk.md -o ~/Desktop/talk.html
```

---

## Slide format

A deck is a single `.md` file. The first `---` block is the deck config; each subsequent `---` block is slide frontmatter followed by slide content.

```markdown
---
design: neue
palette: dark-slate
accent: "#e63946"
meta:
  title: My Talk
  author: Ada Lovelace
  organization: FHNW
  date: "2026-05-13"
width: 1920
height: 1080
---

---
layout: title
---
# My Presentation
## Subtitle line

---
layout: chapter
number: 1
part: Part One
---
# Chapter Title

---
layout: focus
eyebrow: Key idea
attribution: Someone Famous
---
# A short, punchy statement.

---
layout: image-text
image: ./img/photo.jpg
section: Context
---
# Heading beside the image

Supporting paragraph text.

---
layout: split
section: Deep Dive
---
```python
def greet(name):
    return f"Hello, {name}!"
```

- The left pane gets the first block
- The right pane gets the rest
- Any block type works — code, image, text

---
layout: full-bleed-image
image: ./img/hero.jpg
overlay: true
---
# Optional overlay title
```

### Slide layouts

| Layout | Required frontmatter | Content |
|---|---|---|
| `title` | — | `# Title` and/or `## Subtitle` |
| `chapter` | `number:`, optional `part:`, `description:` | `# Chapter title` |
| `focus` | optional `eyebrow:`, `attribution:` | `# Statement` or freeform content |
| `image-text` | `image: path` | `# Heading` + paragraph text |
| `split` | — | First block → left pane; remaining blocks → right pane |
| `full-bleed-image` | `image: path`, optional `overlay: true` | Optional `# Overlay title` |

Slides without a recognised `layout:` fall through to a generic renderer that renders the full markdown body with standard slide chrome. Use this for custom layouts with inline HTML.

### Lists

Unordered and ordered lists work on any slide — no special layout needed:

```markdown
---
section: Summary
---
# Key points

- First item
- Second item with **emphasis**

1. Ordered item one
2. Ordered item two
```

### Speaker notes

Add per-slide notes in frontmatter. Notes support **markdown** and appear in the presenter view.

```yaml
---
layout: focus
notes: |
  Keep this slide under 90 seconds.

  - Hit the *demo* first
  - Questions at the end
---
```

`note:` also works as a synonym for `notes:`.

---

## Deck config

| Key | Type | Default | Description |
|---|---|---|---|
| `design` | string | `neue` | Theme name |
| `palette` | string | — | Color palette override |
| `accent` | color | — | Accent color shorthand (overrides palette) |
| `params` | map | — | Theme-specific param overrides |
| `meta` | map | — | Metadata injected as `--meta-*` CSS vars |
| `width` | number | `1920` | Slide width in px |
| `height` | number | `1080` | Slide height in px |

### `accent:` shorthand

`accent:` sets `--accent` directly, without knowing theme param names:

```yaml
---
design: editorial
palette: dark
accent: "#16a34a"
---
```

It takes precedence over both palette and `params.primaryColor`.

---

## Themes

Five themes are included:

| Theme | Character |
|---|---|
| `neue` | Clean sans-serif — Inter Tight headlines, neutral defaults |
| `aurora` | Geometric modern — Plus Jakarta Sans, gradient accents |
| `fhnw` | FHNW brand identity, Univers, square accent tiles |
| `editorial` | Serif editorial, Playfair Display, ghost numerals |
| `terminal` | Dark-by-default, JetBrains Mono, terminal green, `>` bullets |

Set the theme in the deck config:

```yaml
design: terminal
```

Override a theme-specific param:

```yaml
design: neue
params:
  primaryColor: "#0066cc"
```

### Palettes

Palettes swap the six core color tokens independently of the theme. All themes are palette-compatible.

| Palette | Character |
|---|---|
| `paper` | Clean white |
| `sage` | Muted sage green |
| `mono` | Pure monochrome |
| `terra` | Warm sand and red |
| `dark-slate` | Dark cool blue |
| `dark-ember` | Dark warm amber |
| `dark-neon` | Dark vivid neon |
| `dark-mono` | Dark neutral grey |

```yaml
design: neue
palette: dark-slate
```

Dark palettes automatically apply syntax highlighting colors and logo inversion. The `terminal` theme is dark by default and applies these without a palette.

### Custom themes

Copy any existing theme folder and edit the CSS. Register it in `src/themeLoader.js`:

```js
const THEMES = {
  neue:     () => import('../themes/neue/index.js'),
  mytheme:  () => import('../themes/mytheme/index.js'),
}
```

See `themes/THEMES.md` for the full theme authoring reference.

### Custom palettes

Add a JSON file to `palettes/`. No registration needed — the filename becomes the palette key.

```json
{
  "name": "Forest",
  "tokens": {
    "--bg":       "#f0f4ef",
    "--ink":      "#1a2e1a",
    "--ink-soft": "#2d4a2d",
    "--muted":    "#5a7a5a",
    "--rule":     "#d8e8d8",
    "--accent":   "#2d7a2d"
  }
}
```

See `palettes/PALETTES.md` for the palette authoring reference.

### Deck metadata as CSS variables

Everything under `meta:` is injected as CSS custom properties:

```yaml
meta:
  title: My Talk
  author: Ada Lovelace
  date: "2026-05-13"
```

```css
/* Available automatically: */
--meta-title
--meta-author
--meta-date
```

---

## Components

Components are Preact JSX files in `components/`. Register them by tag name in `src/registry.jsx`:

```js
import MyComponent from '../components/MyComponent.jsx'

export const registry = {
  mycomponent: MyComponent,
}
```

Use them in slides as lowercase HTML tags:

```markdown
<mycomponent lang="js">
content here
</mycomponent>
```

Because `.slide-body` sets inheritable baseline typography, any raw HTML written in a slide automatically picks up the theme's body text style. You only need inline styles for structural layout:

```markdown
---
layout: four-columns
---
# Heading

<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 48px;">
  <div><strong>One</strong> — description text</div>
  <div><strong>Two</strong> — description text</div>
  <div><strong>Three</strong> — description text</div>
  <div><strong>Four</strong> — description text</div>
</div>
```

### Built-in: `<codeblock>`

Fenced code blocks are automatically converted to `<codeblock>` elements with syntax highlighting:

````markdown
```js
const x = 1 + 2
```
````

Or written explicitly for full attribute control:

```markdown
<codeblock lang="python">
def greet(name):
    return f"Hello, {name}!"
</codeblock>
```

Supported languages: `js`, `ts`, `jsx`, `python`, `bash`, `css`, `html`, `json`, `yaml`, `sql`.

---

## Print / PDF

Open the built HTML in any browser and use **File → Print → Save as PDF**. Each slide prints as one page at the correct aspect ratio (1920 × 1080).

---

## Project structure

```
mdeck/
  cli.js                CLI entry point (dev / present / build / preview)
  components/
    CodeBlock.jsx        Syntax-highlighted code block (Prism)
    code-block.css       Code block styles
  examples/
    demo.md              Example slide deck
  palettes/
    paper.json           Built-in palettes
    dark-slate.json
    dark-ember.json
    terra.json
  docs/
    authoring.md         Slide authoring reference
    palettes.md          Palette authoring reference
    themes.md            Theme authoring reference
  src/
    main.jsx             App entry — parses slides, loads theme, renders
    markedSetup.js       Overrides marked's code renderer → <codeblock>
    parseSlides.js       Splits .md into {deckConfig, slides[]}
    registry.jsx         Maps tag names to Preact components
    renderSlide.jsx      All slide layout components
    slidesPlugin.js      Vite virtual-module plugin for the slides file
    themeLoader.js       Loads theme + palette CSS into the document
  themes/
    neue/                Clean sans-serif theme
    aurora/              Geometric modern theme
    fhnw/                FHNW brand theme
    editorial/           Serif editorial theme
    terminal/            Dark terminal theme
    THEMES.md            Theme authoring reference
  index.html             Vite HTML entry point
  package.json
```
