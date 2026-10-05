# Palettes

A palette is a set of color values that map to the framework's core token vocabulary. Palettes are independent of any specific theme — any theme that respects the token contract will render correctly with any palette.

## Using a palette

Set `palette:` in the deck frontmatter:

```yaml
---
theme: neue
palette: paper
---
```

Palette values sit between the theme's base token defaults and any individual `params:` overrides, so per-deck color tweaks always win.

## Tokens

| Token | Role |
|---|---|
| `--bg` | Slide background |
| `--surface` | Raised surfaces — code block background, image pane fill |
| `--ink` | Primary text |
| `--ink-soft` | Body text, descriptions |
| `--muted` | Small metadata — headers, footers, eyebrows |
| `--rule` | Borders, dividers |
| `--accent` | Brand highlight — bullet markers, `em` text, code border |
| `--accent-2` | Secondary accent — used for paired color moments |
| `--on-accent` | Text color for content rendered *on top of* the accent background |

All nine tokens should be set. Omitting a token leaves the theme default in place, which may look inconsistent.

## Authoring a palette

A palette is one kind of [extension](extensions.md): a folder named after the
palette containing `extension.toml`. Put it under the framework's
`assets/extensions/palettes/` folder or in `extensions/` beside a deck.

```toml
schema = 1
kind = "palette"
id = "notebook"
title = "Blue notebook"
description = "Cool blues on white."

[tokens]
"--bg" = "#ffffff"
"--surface" = "#f5f5f5"
"--ink" = "#0a0a0a"
"--ink-soft" = "#2a2a2a"
"--muted" = "#6b6b6b"
"--rule" = "#e5e5e5"
"--accent" = "#2563eb"
"--accent-2" = "#7c3aed"
"--on-accent" = "#ffffff"
```

No registration step is needed; any palette folder is found automatically.
Token names start with dashes, so quote them as TOML keys.

## Dark palettes

Add `dark = true` above `[tokens]` to mark a palette as dark. This triggers dark-mode adjustments in the runtime: syntax-highlight colors are inverted, and the logo gets a CSS `invert()` filter so light logos remain legible.

```toml
schema = 1
kind = "palette"
id = "dark-slate"
title = "Dark Slate"
dark = true

[tokens]
"--bg" = "#0d0d0d"
# ...
```

## Built-in palettes

| Light | Dark |
|---|---|
| `paper` — white and neutral | `dark-slate` — cool and restrained |
| `sage` — muted green | `dark-ember` — warm highlights |
| `mono` — black and white | `dark-neon` — vivid highlights |
| `terra` — warm earth colors | `dark-mono` — dark monochrome |

## The `--on-accent` token

Some themes render text directly on the accent background — the FHNW theme does this for the title Akzentfläche, `em` highlights, ordered-list number badges, and full-bleed overlay titles. The default is `var(--ink)`, which works when the accent is bright (e.g. FHNW yellow + black ink). It breaks when accent and ink have similar luminance.

Set `--on-accent` explicitly whenever the accent color is dark, light, or mid-tone in a way that gives poor contrast against `--ink`:

| Situation | `--on-accent` |
|---|---|
| Bright accent, dark ink (default) | omit — inherits `var(--ink)` |
| Dark accent (e.g. near-black) | `#ffffff` |
| Light accent (e.g. light gray) | `#000000` or `#111111` |
| Saturated mid-tone (orange, red, blue) | pick whichever of black/white gives ≥ 4.5:1 contrast |

## Design notes

- `--surface` is for raised UI elements like code blocks and image pane fills. On dark palettes keep it slightly lighter than `--bg`; on light palettes slightly darker.
- `--rule` is used for borders and dividers. It should sit between `--bg` and `--surface` in lightness.
- `--muted` is used for small uppercase text. It sits against `--bg`, not body text, so it can be quite subdued.
- Syntax highlighting colors are not palette-controlled. They are owned by the `CodeBlock` component (`src/components/code-block.css`) and stay consistent across palettes.
