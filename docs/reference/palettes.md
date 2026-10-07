# Palettes

A palette gives a deck its colours. It is the only place colours come from: themes set type, spacing and layout, and leave colour to the palette, so any palette fits any theme.

Every palette is a family with two variants, **light** and **dark**. A deck chooses the family with `palette:` and the variant with `appearance:`. Themes use the *other* variant for inverted slides, such as neue's statement slides, so those stay readable and in tune.

## Using a palette

```yaml
---
theme: neue
palette: nordic       # optional; without it the theme's default palette
appearance: dark      # optional: light or dark; without it the theme's default
---
```

The presenter view and the reader view switch palette and light or dark without changing the file. Choose dark for a dark lecture hall, light for a bright seminar room.

## Built-in palettes

| Palette | Light | Dark |
|---|---|---|
| `swiss` | white, black and signal red | black, white and red |
| `nordic` | ice grey, deep navy and a cool steel blue | polar night with ice blue |
| `neon` | white with violet and magenta | black with neon violet and pink |
| `lagoon` | teal on warm stone, orange second accent | deep teal-black, bright teal |
| `paper` | off-white paper and near-black ink with one orange accent | charcoal with a softer orange |

`mdeck list palettes` lists them, with any of your own.

Each theme names a default: neue uses `swiss`, academic `nordic`, aurora `neon`.

More palettes are in the [theme repository](https://github.com/tilman-schieber/mdeck-themes). The palettes cobalt, terra, phosphor, pastel and forest, built in before mdeck 3.0, are there; installing the theme duet, editorial, terminal or sketch brings its palette along. Graphite and ember were removed because the built-in nordic and paper look almost the same; a deck that names them is told which to use. Install one with `mdeck palettes install <palette> my-talk.md`.

## Colours

Every variant sets all nine:

| Colour | Role |
|---|---|
| `--bg` | Slide background |
| `--surface` | Raised surfaces: code blocks, image panes, cards |
| `--ink` | Headings and primary text |
| `--ink-soft` | Body text |
| `--muted` | Small labels: headers, footers, captions |
| `--rule` | Lines and dividers |
| `--accent` | The highlight: emphasis, markers, chapter slides |
| `--accent-2` | A second highlight for themes that pair two |
| `--on-accent` | Text set on the accent, such as a chapter slide's title |

Themes may mix them (for example a light tint of the accent), and read the other variant as `--inverse-bg`, `--inverse-ink`, `--inverse-accent` and so on.

## Making a palette

A palette is an [extension](extensions.md): a folder named after it with an `extension.toml`, in `extensions/` beside a deck.

```toml
schema = 1
kind = "palette"
id = "harbour"
title = "Harbour"
description = "Sea blue and rust on chalk white."

[light]
"--bg" = "#f7f9fa"
"--surface" = "#e9eef1"
"--ink" = "#0b1d2a"
"--ink-soft" = "#22394a"
"--muted" = "#4f6474"
"--rule" = "#c9d7e2"
"--accent" = "#0a6aa8"
"--accent-2" = "#b45309"
"--on-accent" = "#ffffff"

[dark]
"--bg" = "#0d1a24"
"--surface" = "#152635"
"--ink" = "#eef4f8"
"--ink-soft" = "#c8d6e0"
"--muted" = "#8ea3b3"
"--rule" = "#24384b"
"--accent" = "#5fb3f0"
"--accent-2" = "#f59e5b"
"--on-accent" = "#0d1a24"
```

Colour names start with dashes, so quote them as TOML keys. A dark variant also gets dark code colours and an inverted logo; set `--logo-filter` or the `--token-*` code colours in `[dark]` to change that.

`theme = "my-theme"` makes a palette private: only that theme offers it, as a corporate design theme does with its own colours.

## Readability

`mdeck check` measures the contrast of your palette's colours and warns when they are too close to read from the back of a room:

| Pair | At least |
|---|---|
| text (`--ink`) on the background | 7 : 1 |
| body text and muted text on the background | 4.5 : 1 |
| both accents on the background | 3 : 1 (large type) |
| text on the accent | 3 : 1 |

The built-in palettes meet these in both variants. A private palette may use its accent only as a surface (a corporate yellow, say), so its accents are not checked as text.
