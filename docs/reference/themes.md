# Themes

A theme defines how slides look: typography, spacing and layout structure. Its
colours come from a [palette](palettes.md): each theme names a default, and the
deck may choose another. A theme is one kind of [extension](extensions.md).

## Using a theme

Set `theme:` in the deck frontmatter:

```yaml
---
theme: neue
---
```

| Theme | Look | Default palette |
|---|---|---|
| `neue` | Swiss style: large flush-left type, rules, red on white | `swiss` |
| `aurora` | Northern lights: curtains of light, night-sky chapters, frosted glass | `neon` |
| `duet` | Two voices: heavy slab headings, split slides as two colour fields, diagonal chapters | `cobalt` |
| `editorial` | Magazine spread: masthead rule, drop caps, pull quotes, Roman chapter numerals | `terra` |
| `fhnw` | The FHNW corporate design | `brand` (the only one) |
| `terminal` | A terminal session: prompts, a blinking cursor, a tmux status bar | `forest`, dark |

`mdeck list my-talk.md` lists them with their descriptions.

## Theme structure

```text
assets/extensions/themes/my-theme/     built-in
extensions/my-theme/                    beside a deck
  extension.toml     identity, default palette, fonts, tokens, parameters
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
palette = "lagoon"
fonts = ["https://fonts.googleapis.com/css2?family=..."]

[tokens]
"--fs-display" = "128px"
"--fs-h" = "64px"
"--fs-body" = "34px"
"--pad-x" = "140px"
"--pad-y" = "110px"
"--font-display" = "\"My Display Font\", sans-serif"
"--font-body" = "\"My Body Font\", sans-serif"

[params.fontDisplay]
token = "--font-display"
title = "Display font"
```

`palette` names the default palette. `tokens` hold the typography and spacing
values the stylesheet uses; mdeck writes them into a `:root` block ahead of the
stylesheet. A theme may not set the nine palette colours.

`params` connect author-facing names to tokens. Users set them in the deck:

```yaml
params:
  fontDisplay: "Georgia, serif"
```

A parameter's default is its token's value. Unknown parameter names are
reported by `mdeck check`.

Optional settings: `description`, `appearance = "dark"` for a theme that starts
dark, and `palettes = [...]` to offer only those palettes (the FHNW theme offers
only `brand`). `[files] styles` may name one stylesheet or a list.

### `styles.css`

Layout CSS for all slide types. It refers to the palette colours (`--bg`,
`--ink`, `--accent` …) and the theme's tokens for every colour and spacing value
and contains no `:root` defaults of its own. It must style:

- `.slide` — base slide
- `.slide-header`, `.slide-footer`, `.slide-body` — structural rails
- `.slide--title`, `.slide--chapter`, `.slide--focus`, `.slide--image-text`, `.slide--split`, `.slide--full-bleed-image` — the built-in layouts

## Custom layouts

Define reusable slide structures with [deck-local layouts](layouts.md).
They provide named regions, typed properties, and shared slide chrome without
editing the framework. Theme CSS continues to style those structures.

For compatibility, an unrecognised `layout:` value warns and falls through to the
generic renderer. It renders the full Markdown body with standard slide chrome
and emits a `.slide--<layout-name>` class. Prefer a declared layout for new layouts.

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

## Colour contract

A theme uses only the nine palette colours, and mixes of them
(`color-mix(in oklab, var(--accent) 14%, var(--bg))`). This is what makes every
palette fit every theme. For an inverted slide it reads the palette's other
variant, `--inverse-bg`, `--inverse-ink`, `--inverse-accent` and so on, which is
tuned to be read on its own background.

Themes may define additional tokens for type, spacing and shapes; those are
theme-specific and are not affected by palettes.
