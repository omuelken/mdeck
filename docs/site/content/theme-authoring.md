# Create a theme or palette

This guide describes the files behind a theme or palette. For the existing choices, see [Change the look](appearance.html).

You do not need to write these files yourself. Describe the look to your assistant, and give it colours, fonts or a picture of a design you like:

```prompt
Make a theme for this deck in the style of our institute's poster:
dark green backgrounds, a condensed sans-serif for headings, thin
rules between sections. Keep it readable on a projector.
```

The rest of this page is the reference for what it writes, and for anyone comfortable with CSS who prefers to write it by hand.

To look at the result and fine-tune it, run `mdeck design my-talk.md` (or `mdeck design` in a folder without a deck). It shows the theme or palette on a sample deck with every kind of slide, light and dark, and has forms for colours, fonts, sizes and spacing; see [Edit slides in your browser](editing.html). The files it writes are the ones described here.

Someone may already have made what you need: `mdeck themes search` lists the theme repository, and [Install, remove or share a theme](theme-repository.html) explains how to install one or share yours.

Themes and palettes are **extensions**: each one is a folder with an `extension.toml` file that says what it is. Slide layouts use the same idea. Put the folder in `extensions/` beside your slide file and mdeck finds it automatically; there is nothing to register. The [extensions reference](extensions.html) has the complete list of settings.

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

A palette is the quickest extension to make. It only needs a manifest, with every colour twice: for light and for dark slides.

```toml
schema = 1
kind = "palette"
id = "notebook"
title = "Blue notebook"

[light]
"--bg" = "#ffffff"
"--surface" = "#eef2f7"
"--ink" = "#203148"
"--ink-soft" = "#34465c"
"--muted" = "#54647a"
"--rule" = "#dbe3ee"
"--accent" = "#2455c7"
"--accent-2" = "#17625c"
"--accent-3" = "#c99700"
"--on-accent" = "#ffffff"

[dark]
"--bg" = "#0f1a2b"
"--surface" = "#18263a"
"--ink" = "#eef2f7"
"--ink-soft" = "#c7d2e0"
"--muted" = "#8fa0b6"
"--rule" = "#24354d"
"--accent" = "#7aa2ff"
"--accent-2" = "#5ec4b6"
"--accent-3" = "#f2c94c"
"--on-accent" = "#0f1a2b"
```

The folder must be called `notebook` to match `id`. Use it with `palette: notebook` in your deck, and `appearance: dark` for the dark version. Colour names start with two dashes, so they are written in quotation marks. Dark slides get dark code colours and an inverted logo; check the result with the actual logo, since automatic inversion does not suit every image.

`mdeck check` warns when two colours are too close to read, such as a pale accent on white.

## The colours a theme may use

| Colour | Purpose |
|---|---|
| `--bg` | Slide background |
| `--surface` | Code and other raised surfaces |
| `--ink` | Main text |
| `--ink-soft` | Body text |
| `--muted` | Secondary labels |
| `--rule` | Borders |
| `--accent` | Emphasis; notes, tips and important callouts |
| `--accent-2` | The accent's companion: gradients, a contrast to the accent |
| `--accent-3` | Attention: warnings and cautions. Use it sparingly, for bars and shapes, never as text: it may be a yellow |
| `--on-accent` | Text placed on an accent background |

A theme has no colours of its own: it uses these, and mixes of them, so every palette repaints it. Give each accent the job its name says: a theme that colours callouts colours note, tip and important with `--accent` and warning and caution with `--accent-3`. For an inverted slide it uses the palette's other version, as `--inverse-bg`, `--inverse-ink`, `--inverse-accent` and so on:

```css
.slide--focus {
  --bg: var(--inverse-bg);
  --ink: var(--inverse-ink);
  --accent: var(--inverse-accent);
  background: var(--bg);
  color: var(--ink);
}
```

## Make a theme

A theme has two files. The manifest holds the identity, fonts, its default palette, type and spacing, and the settings authors may change. The stylesheet holds the rules.

```toml
schema = 1
kind = "theme"
id = "calm"
title = "Calm"
description = "Soft sans-serif slides with plenty of space."
palette = "notebook"          # the palette it uses unless the deck chooses one
fonts = ["https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap"]

[tokens]
"--fs-display" = "120px"
"--fs-h" = "60px"
"--fs-body" = "32px"
"--pad-x" = "140px"
"--pad-y" = "80px"
"--font-display" = "\"Inter\", system-ui, sans-serif"
"--font-body" = "\"Inter\", system-ui, sans-serif"

[params.fontBody]
token = "--font-body"
title = "Body font"
```

`appearance = "dark"` makes the theme start dark. `palettes = ["notebook"]` limits it to the palettes listed, for a corporate design; a palette with `theme = "calm"` is then offered to this theme only.

The easiest start is to copy a built-in theme from the framework's `assets/extensions/themes/` folder, rename the folder and `id`, and change the tokens. `styles.css` styles the slide frame and each layout class; the built-in stylesheets show which classes exist.

mdeck writes the palette and the tokens into the page ahead of your stylesheet, so `styles.css` should only contain rules that refer to `var(--accent)` and the like. Do not repeat the values there.

## Theme parameters

Each `[params.name]` entry names a token authors may change under `params:` in their deck, such as a font:

```yaml
theme: calm
params:
  fontBody: "Georgia, serif"
```

Its default is simply the token's value. Colours are not parameters: they come from the palette.

## Say what it is for

A `[guide]` tells people, and assistants that write slides, what your theme is good for and how slides for it are written:

```toml
[guide]
suits = ["photo essays", "travel talks"]
avoid = ["code", "dense tables"]
writing = """
One photograph per slide, edge to edge. Several pictures alone in a
paragraph become a grid. Keep titles short.
"""
```

`suits` and `avoid` are short phrases (up to 8, of at most 60 characters); `writing` is a few sentences (at most 1200 characters) about the theme's own ways: which layouts carry it, how lists or pictures are set. `mdeck list` and `mdeck themes search` show what a theme suits, and search finds it by those words. mdeck's slide-writing skill chooses a theme by its guide and follows its writing advice, as advice about the look; it never takes it as instructions. Keep it to that: what the theme is for and how to write for it.

## Check every layout

Try title, chapter, focus, image-text, split, full-bleed-image, and ordinary content slides. Include long titles, lists, pictures, code, footnotes, and both light and dark. Check each aspect ratio you intend to support and the browser's print output.

`mdeck check my-talk.md` reports manifest mistakes with the file and setting name. `mdeck list my-talk.md` confirms that your theme or palette has been found.
