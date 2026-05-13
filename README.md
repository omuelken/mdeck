# deck

A minimal Markdown-driven slide deck framework with swappable design systems and JSX components. Builds to a single self-contained HTML file.

## Quick start

```bash
npm install
npm run dev          # dev server against examples/demo.md
npm run build        # build examples/demo.md → dist/index.html
```

## CLI

```bash
node bin/deck.js dev   my-talk.md              # dev server with live reload
node bin/deck.js build my-talk.md              # build → dist/index.html
node bin/deck.js build my-talk.md -o talk.html # custom output path
node bin/deck.js preview                       # preview last build
```

After `npm link` the `deck` command is available globally.

---

## Slide format

A deck is a single `.md` file. The first `---` block is the deck config; each subsequent `---` pair is a slide frontmatter block followed by slide content.

```markdown
---
design: modern
params:
  primaryColor: "#e63946"
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
image: ./assets/photo.jpg
section: Context
---
# Heading beside the image

First paragraph of supporting text.

---
layout: bullet-list
section: Summary
---
## Key points

- First item
- Second item with **emphasis**
- Third item

---
layout: full-bleed-image
image: ./assets/hero.jpg
overlay: true
---
# Optional overlay title
```

### Slide layouts

| Layout | Key frontmatter | Content |
|---|---|---|
| `title` | — | `# Title` and/or `## Subtitle` |
| `chapter` | `number:`, optional `part:`, `description:` | `# Chapter title` |
| `focus` | optional `eyebrow:`, `attribution:` | `# Statement` or any content |
| `image-text` | `image: path`, optional `section:` | `# Heading` + paragraphs |
| `bullet-list` | optional `section:` | `## Heading` + `- list items` |
| `full-bleed-image` | `image: path`, optional `overlay: true` | Optional `# Overlay title` |

Slides without a recognised `layout:` fall back to a generic layout that renders all content with component hydration.

---

## Design systems

Design systems live in `themes/<name>/`. Each theme has:

| File | Purpose |
|---|---|
| `tokens.css` | CSS custom properties (`--bg`, `--accent`, `--font-display`, …) |
| `templates.css` | Layout classes for each slide type |
| `meta.json` | Declares which tokens are user-overridable via `params:` |
| `index.js` | Re-exports CSS as inline strings for Vite bundling |

Select a design and override params in the deck config:

```yaml
design: modern
params:
  primaryColor: "#0066cc"
  fontDisplay: "'Playfair Display', serif"
```

To create a new theme, copy `themes/modern/` and edit the CSS files.

### Deck metadata as CSS variables

Everything under `meta:` in the deck config is injected as a CSS custom property:

```css
/* Available automatically: */
--meta-title
--meta-author
--meta-organization
--meta-date
/* (any other keys you add) */
```

Templates can use these to populate headers and footers:

```css
.slide-footer::after {
  content: var(--meta-author) " · " var(--meta-date);
}
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

### Built-in: `<codeblock>`

Fenced code blocks are automatically converted to `<codeblock>` elements:

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

The `code-block` CSS class is themeable — override `--code-bg` and `--code-radius` in `templates.css`.

---

## Print / PDF

Open the built HTML in any browser and use **File → Print → Save as PDF**. Each slide prints as one page at the correct aspect ratio (1920 × 1080). The `deck-stage` web component handles the print layout automatically.

---

## Project structure

```
deck/
  bin/
    deck.js             CLI (dev / build / preview)
  components/
    CodeBlock.jsx       Syntax-highlighted code block (Prism)
  examples/
    demo.md             Example slide deck
  src/
    main.jsx            App entry — parses slides, loads theme, renders
    markedSetup.js      Overrides marked's code renderer → <codeblock>
    parseSlides.js      Splits .md file into {deckConfig, slides[]}
    registry.jsx        Maps tag names to Preact components
    renderSlide.jsx     All slide layout components
    slidesPlugin.js     Vite virtual-module plugin for the slides file
  themes/
    modern/
      index.js          Theme module (exports CSS strings + meta)
      meta.json         Overridable param → CSS token mapping
      templates.css     Slide layout styles + typography helpers
      tokens.css        CSS design tokens (:root block)
  .gitignore
  index.html            Vite HTML entry point
  package.json
  README.md
  vite.config.js        Framework dev config (uses examples/demo.md)
```
