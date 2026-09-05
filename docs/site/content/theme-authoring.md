# Create a theme or palette

This guide is for people comfortable with CSS. For the existing choices, see [Change the look](appearance.html).

Themes and palettes are **extensions**: each one is a folder with an `extension.toml` file that says what it is. Slide designs (templates) use the same idea. Put the folder in `extensions/` beside your slide file and mdeck finds it automatically; there is nothing to register. The [extensions reference](extensions.html) has the complete list of settings.

```text
my-talk/
  my-talk.md
  extensions/
    notebook/          a palette
      extension.toml
    calm/              a theme
      extension.toml
      styles.css
```

## Add a palette

A palette is the quickest extension to make. It only needs a manifest:

```toml
schema = 1
kind = "palette"
id = "notebook"
title = "Blue notebook"

[tokens]
"--bg" = "#ffffff"
"--surface" = "#eef2f7"
"--ink" = "#203148"
"--ink-soft" = "#34465c"
"--muted" = "#54647a"
"--rule" = "#dbe3ee"
"--accent" = "#2455c7"
"--accent-2" = "#17625c"
"--on-accent" = "#ffffff"
```

The folder must be called `notebook` to match `id`. Use it with `palette: notebook` in your deck. Add `dark = true` above `[tokens]` for a dark palette; the loader then applies dark syntax-highlighting colors and a logo inversion filter. Check the result with the actual logo; automatic inversion does not suit every image.

Token names start with two dashes, so they are written in quotation marks.

## Shared color tokens

| Token | Purpose |
|---|---|
| `--bg` | Slide background |
| `--surface` | Code and other raised surfaces |
| `--ink` | Main text |
| `--ink-soft` | Body text |
| `--muted` | Secondary labels |
| `--rule` | Borders |
| `--accent` | Main highlight |
| `--accent-2` | Secondary highlight |
| `--on-accent` | Text placed on an accent background |

Use these tokens rather than hardcoded colors in layout CSS. This allows palettes to repaint the theme. Check the contrast of small text and text placed on an accent background.

## Make a theme

A theme has two files. The manifest holds the identity, fonts, default token values and the settings authors may change. The stylesheet holds the rules.

```toml
schema = 1
kind = "theme"
id = "calm"
title = "Calm"
description = "Soft sans-serif slides with plenty of space."
fonts = ["https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap"]

[tokens]
"--bg" = "#fbfbf9"
"--surface" = "#f1f1ec"
"--ink" = "#1c1c1a"
"--ink-soft" = "#3a3a36"
"--muted" = "#7a7a72"
"--rule" = "#e3e3dc"
"--accent" = "#2455c7"
"--fs-display" = "120px"
"--fs-h" = "60px"
"--fs-body" = "32px"
"--pad-x" = "140px"
"--pad-y" = "80px"
"--font-display" = "\"Inter\", system-ui, sans-serif"
"--font-body" = "\"Inter\", system-ui, sans-serif"

[params.primaryColor]
token = "--accent"
title = "Primary color"
```

The easiest start is to copy a built-in theme from the framework's `assets/extensions/themes/` folder, rename the folder and `id`, and change the tokens. `styles.css` styles the slide frame and each layout class; the built-in stylesheets show which classes exist.

mdeck writes the tokens into the page ahead of your stylesheet, so `styles.css` should only contain rules that refer to `var(--accent)` and the like. Do not repeat the defaults there.

## Theme parameters

Each `[params.name]` entry names a token authors may change under `params:` in their deck:

```yaml
design: calm
params:
  primaryColor: "#e63946"
```

Its default is simply the token's value, so the preview controls and the rendered slides always match. Values are applied in this order: theme tokens, palette, parameters, then the `accent` and `accent2` shorthands.

## Check every layout

Try title, chapter, focus, image-text, split, full-bleed-image, and ordinary content slides. Include long titles, lists, pictures, code, footnotes, and a dark palette. Check each aspect ratio you intend to support and the browser's print output.

`mdeck check my-talk.md` reports manifest mistakes with the file and setting name. `mdeck extensions my-talk.md` confirms that your theme or palette has been found.
