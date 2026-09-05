# Themes

A theme defines how slides look: typography, spacing, layout structure, and default colors. Themes are independent of content and palettes.

## Using a theme

Set `design:` in the deck frontmatter:

```yaml
---
design: neue
---
```

## Theme structure

```
themes/
  my-theme/
    index.js        # Entry point — re-exports everything below
    tokens.css      # CSS custom properties (:root vars)
    templates.css   # Slide layout CSS
    meta.json       # Theme metadata, fonts, configurable params
```

### `tokens.css`

Defines the CSS custom properties that the rest of the theme uses. Must include the six core color tokens (so palettes work) and any typography and spacing tokens.

```css
:root {
  /* Core color tokens — must be present for palette compatibility */
  --bg:       #ffffff;
  --ink:      #0a0a0a;
  --ink-soft: #2a2a2a;
  --muted:    #6b6b6b;
  --rule:     #e5e5e5;
  --accent:   #2563eb;

  /* Typography */
  --fs-display: 128px;
  --fs-h:        64px;
  --fs-body:     34px;
  /* ... */

  /* Spacing */
  --pad-x: 140px;
  --pad-y: 110px;
  /* ... */

  /* Type families */
  --font-display: "My Display Font", sans-serif;
  --font-body:    "My Body Font", sans-serif;
}
```

### `templates.css`

Layout CSS for all slide types. References token vars for all color and spacing values — no hardcoded colors. Must define styles for:

- `.slide` — base slide
- `.slide-header`, `.slide-footer`, `.slide-body` — structural rails
- `.slide--title`, `.slide--chapter`, `.slide--focus`, `.slide--image-text`, `.slide--bullet-list`, `.slide--full-bleed-image` — the six built-in layouts

### `meta.json`

Declares the theme name, font URLs, and which CSS tokens are user-overridable via `params:` in the deck frontmatter.

```json
{
  "name": "My Theme",
  "fonts": [
    "https://fonts.googleapis.com/css2?family=..."
  ],
  "params": {
    "primaryColor": { "token": "--accent", "default": "#2563eb" },
    "backgroundColor": { "token": "--bg", "default": "#ffffff" }
  }
}
```

Each entry in `params` maps a user-facing name to a CSS custom property. Users set these in the deck frontmatter:

```yaml
params:
  primaryColor: "#e63946"
```

### `index.js`

Re-exports everything using Vite's `?inline` import for CSS:

```js
import tokensCSS from './tokens.css?inline'
import templatesCSS from './templates.css?inline'
import themeMeta from './meta.json'

export { tokensCSS, templatesCSS, themeMeta }
```

## Registering a theme

Add an entry to the `THEMES` dict in `src/themeLoader.js`:

```js
const THEMES = {
  neue:     () => import('../themes/neue/index.js'),
  my-theme: () => import('../themes/my-theme/index.js'),
}
```

The key becomes the value used in `design:` in the deck frontmatter.

## Custom layouts

Define reusable slide structures with [deck-local templates](templates.md).
They provide named regions, typed properties, and shared slide chrome without
editing the framework. Theme CSS continues to style those structures.

For compatibility, an unrecognised `layout:` value warns and falls through to the
generic renderer. It renders the full Markdown body with standard slide chrome
and emits a `.slide--<layout-name>` class. Prefer a declared template for new layouts.

To style a custom layout, target `.slide--<layout-name>` in a CSS file loaded alongside your deck, or use inline styles in your markdown HTML.

Because `.slide-body` sets baseline typography (`font-family`, `font-size`, `color`, `line-height`) as inheritable defaults, any raw HTML you write inside a custom slide automatically inherits the theme's body text style. You only need inline styles for structural concerns like grid layout:

```markdown
---
layout: four-columns
---
# My heading

<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 48px;">
  <div><strong>One</strong> — description text</div>
  <div><strong>Two</strong> — description text</div>
  <div><strong>Three</strong> — description text</div>
  <div><strong>Four</strong> — description text</div>
</div>
```

Standard markdown elements (`h1`–`h6`, `p`, `ul`, `ol`, `strong`, `em`, `code`) are styled by the theme and work without any inline styles.

## Token contract

Themes must define the six core color tokens listed in `tokens.css` above. This is what makes palettes work across themes — palettes override these exact variable names, so any theme that defines them will repaint correctly when a palette is applied.

Themes may define additional tokens beyond the core six; those are theme-specific and will not be affected by palettes.
