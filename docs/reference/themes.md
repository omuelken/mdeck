# Themes

A theme defines how slides look: typography, spacing, layout structure, and
default colors. Themes are independent of content and palettes. A theme is one
kind of [extension](extensions.md).

## Using a theme

Set `design:` in the deck frontmatter:

```yaml
---
theme: neue
---
```

| Theme | Look |
|---|---|
| `neue` | Clear sans-serif type, warm stone background, teal accent |
| `aurora` | Geometric shapes, violet accent with a derived second accent |
| `duet` | Slab-serif headings and two accent colors |
| `editorial` | Magazine look with Playfair Display and Lora |
| `fhnw` | The FHNW corporate design |
| `terminal` | Dark by default, monospace throughout |

`mdeck extensions my-talk.md` lists them with their descriptions.

## Theme structure

```text
assets/extensions/themes/my-theme/     built-in
extensions/my-theme/                    beside a deck
  extension.toml     identity, fonts, token defaults, parameters
  styles.css         slide frame and layout rules
```

No registration step is needed: any theme folder in either place is found
automatically, and the `mdeck new` wizard offers it.

### `extension.toml`

```toml
schema = 1
kind = "theme"
id = "my-theme"
title = "My Theme"
fonts = ["https://fonts.googleapis.com/css2?family=..."]

[tokens]
"--bg" = "#ffffff"
"--ink" = "#0a0a0a"
"--ink-soft" = "#2a2a2a"
"--muted" = "#6b6b6b"
"--rule" = "#e5e5e5"
"--accent" = "#2563eb"
"--fs-display" = "128px"
"--fs-h" = "64px"
"--fs-body" = "34px"
"--pad-x" = "140px"
"--pad-y" = "110px"
"--font-display" = "\"My Display Font\", sans-serif"
"--font-body" = "\"My Body Font\", sans-serif"

[params.primaryColor]
token = "--accent"
title = "Primary color"

[params.backgroundColor]
token = "--bg"
title = "Background"
```

`tokens` hold the default values of the CSS custom properties the stylesheet
uses. mdeck writes them into a `:root` block ahead of the stylesheet. Include
the core color tokens so palettes work, plus the typography and spacing tokens
the rules refer to.

`params` connect author-facing names to tokens. Users set them in the deck:

```yaml
params:
  primaryColor: "#e63946"
```

A parameter's default is its token's value, so the presenter controls and the
rendered slides always agree. Unknown parameter names are reported by
`mdeck check`.

Optional settings: `description`, `dark = true` for a dark-by-default theme,
`accent2 = true` when the theme uses `--accent-2`, and `accent2Preview` when
that token is a CSS expression rather than a plain color. `[files] styles` may
name one stylesheet or a list.

### `styles.css`

Layout CSS for all slide types. It references token variables for every color
and spacing value and contains no `:root` defaults of its own. It must style:

- `.slide` — base slide
- `.slide-header`, `.slide-footer`, `.slide-body` — structural rails
- `.slide--title`, `.slide--chapter`, `.slide--focus`, `.slide--image-text`, `.slide--split`, `.slide--full-bleed-image` — the built-in layouts

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

Themes define the core color tokens in `[tokens]`. This is what makes palettes
work across themes: palettes override these exact variable names, so any theme
that defines them repaints correctly when a palette is applied.

Themes may define additional tokens beyond the core set; those are
theme-specific and are not affected by palettes.
