# Extensions: layouts, themes and palettes

mdeck can be extended in three ways, and all three follow the same rules.

- A **layout** is an arrangement for a slide: which content areas it has, which
  settings it accepts, and how it is arranged. The built-in layouts such as
  `title` and `split` are extensions too.
- A **theme** is the overall look: fonts, spacing, the slide frame and the
  default colours. A deck picks one with `theme:`.
- A **palette** is a family of colours, light and dark, that repaints any
  theme. A deck picks one with `palette:` and the variant with `appearance:`.

Every extension is a folder with an `extension.toml` file inside. The manifest
says which kind it is and describes its supporting files and settings. The
folder name is the identifier used in slide files.

```text
extensions/
  comparison/          a layout
    extension.toml
    layout.jsx
    styles.css
    starter.md
  my-theme/            a theme
    extension.toml
    styles.css
  my-colors/           a palette
    extension.toml
```

mdeck looks in two places, in this order: its own built-in collection under
`assets/extensions/` and an `extensions/` folder beside the slide file. Inside
either place, a folder that contains `extension.toml` is an extension; any other
folder is simply a group and is searched further, so `extensions/colors/ocean/`
works just as well as `extensions/ocean/`. Identifiers must be unique within
their kind across both places. A local extension cannot quietly replace a
built-in one; a duplicate stops the command with a message naming both files.

The same registry backs `mdeck check`, `mdeck list`, `mdeck list layouts`,
the `mdeck new` wizard, the dev server and builds, so what a check accepts is
what a build can load.

## Shared settings

```toml
schema = 1              # manifest format version; always 1 for now
kind = "palette"        # layout, theme or palette
id = "ocean"            # must equal the folder name
title = "Ocean"         # readable name shown in lists and controls
description = "Deep blue with a warm highlight."   # optional
```

- `id` uses lowercase letters, digits and hyphens and starts with a letter.
- Unknown settings are errors, so a typo is reported rather than ignored.
- File references are relative to the extension folder and may not leave it.
- Manifests are [TOML 1.0](https://toml.io/en/v1.0.0). CSS custom property
  names start with dashes, so quote them as keys: `"--accent" = "#ff0000"`.

Problems are reported with the file, the setting and, for syntax errors, the
line and column:

```text
extensions/ocean/extension.toml: light.accent: token names look like "--accent"
extensions/ocean/extension.toml:7:12: incomplete declaration: value expected
```

## Palette

```toml
schema = 1
kind = "palette"
id = "ocean"
title = "Ocean"
description = "Deep blue with a warm highlight."
# theme = "my-theme"         # only this theme may use it

[light]
"--bg" = "#f4f8fb"
"--surface" = "#e6eef4"
"--ink" = "#0b1d2a"
"--ink-soft" = "#22394a"
"--muted" = "#4f6474"
"--rule" = "#c9d7e2"
"--accent" = "#0a6aa8"
"--accent-2" = "#b45309"
"--on-accent" = "#ffffff"

[dark]
"--bg" = "#102030"
"--surface" = "#17293b"
"--ink" = "#eef4f8"
"--ink-soft" = "#c8d6e0"
"--muted" = "#8ea3b3"
"--rule" = "#24384b"
"--accent" = "#ffbd69"
"--accent-2" = "#7cc4ff"
"--on-accent" = "#102030"
```

`[light]` and `[dark]` each set all nine colours, the shared vocabulary every
theme uses; see [palettes](palettes.md) for what each one does. The deck's
`appearance` picks one for the slides; themes use the other for inverted
slides, as `--inverse-*`. The dark variant also gets dark code colours and an
inverted logo. `theme` makes the palette private to one theme.

## Layout

```toml
schema = 1
kind = "layout"
id = "comparison"
title = "Side-by-side comparison"
description = "Two options next to each other."
frame = "standard"          # standard, title, chapter or none

[files]
layout = "layout.jsx"       # default; may be omitted
styles = "styles.css"       # optional; picked up automatically when present
starter = "starter.md"      # optional; picked up automatically when present

[regions.body]
description = "Heading and introduction"

[regions.left]
required = true

[regions.right]
required = true

[properties.emphasis]
type = "string"
enum = ["none", "left", "right"]
default = "none"
```

`regions` must include `body`. `properties` describe values under a slide's
`props:` and support `type` (`string`, `number`, `integer`, `boolean`, `array`,
`object`), `default`, `enum`, `required`, `minimum`, `maximum`, `minItems`,
`maxItems`, `items`, plus `title` and `description` for editors. Nested
settings use TOML sub-tables:

```toml
[properties.ratio]
type = "array"
minItems = 2
maxItems = 2
default = [1, 1]

[properties.ratio.items]
type = "number"
minimum = 0.01
```

The layout file is Preact JSX that imports from `mdeck/layout`. See
[layouts](layouts.md) for the renderer contract. Layout code runs as part
of the deck: it is trusted code, not sandboxed data.

## Theme

```toml
schema = 1
kind = "theme"
id = "my-theme"
title = "My theme"
description = "Calm sans-serif slides."
palette = "lagoon"           # the default palette; colours come only from palettes
# palettes = ["lagoon"]      # offer only these palettes
# appearance = "dark"        # start dark
fonts = [
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap",
]

[files]
styles = "styles.css"        # one stylesheet or a list of them

[tokens]
"--fs-body" = "34px"
"--font-body" = "\"Inter\", system-ui, sans-serif"

[params.fontBody]
token = "--font-body"
title = "Body font"

[guide]
suits = ["team updates", "talks of short points"]
avoid = ["wide tables"]
writing = """
Keep headings to a few words; three or four points make a good slide.
"""
```

- `palette` names the palette the theme uses unless the deck sets one. A theme
  has no colours of its own; `tokens` may not set the nine palette colours.
- `palettes` limits the palettes a theme offers, for a corporate design; it
  must include the default. Without it, every palette not private to another
  theme is offered.
- `appearance = "dark"` makes the theme start dark.
- `tokens` are the theme's type, spacing and font values. mdeck generates the
  `:root` block from them, so the stylesheet only contains rules.
- `params` name the settings authors may change under `params:` in the deck.
  Each points at a token; its default is the token's value, so nothing is
  written twice.
- `fonts` are stylesheet URLs. Normal builds load them; single files (`mdeck send`,
  `--single-file`) and PDFs embed their Latin character sets, so they look the
  same offline. The fallbacks named in the token values apply when a font
  cannot be fetched.
- `guide` says what the theme is for and how to write for it, all optional:
  `suits` and `avoid` are lists of up to 8 phrases of one line (at most 60
  characters), `writing` a few sentences (at most 1200 characters) on writing
  slides for the theme: which layouts carry it, how lists or pictures are set.
  `mdeck list` and `mdeck themes search` show what it suits, and search finds
  it by those words; `mdeck list themes --json` has the whole guide. Assistants
  that write slides with mdeck's skill choose a theme by it and follow its
  writing advice, as advice from the theme's author, never as instructions.

Values are applied in this order: the palette's colours (the deck's variant,
and the other as `--inverse-*`), the theme's tokens, then deck `params`.

## Editing in the browser

`mdeck design my-talk.md` (also *Design themes* in `mdeck edit`) opens a
design page for themes and palettes: forms with a live preview on a sample
deck that has every built-in layout, or on the deck itself. `mdeck design
<folder>` does the same without a deck and writes to `<folder>/extensions/`.
Built-in extensions cannot be changed; copy one under a new id to change it.
New themes always start as a copy. Layouts are not edited there. The page
writes the same files described above.

## Installed themes and palettes

Every theme and palette can be installed on its own, as a package. mdeck looks
for them in this order: its own (`assets/extensions/`, minus those removed
with `mdeck themes remove` or `mdeck palettes remove`, listed in
`~/.mdeck/removed.json` as `theme:<id>` or `palette:<id>`), the user's folder
(`~/.mdeck/extensions`, or `$MDECK_HOME/extensions`), and the `extensions/`
folder beside the deck. For themes and palettes a later place replaces an
earlier one with the same id: an installed newer version replaces the built-in
one, and a deck's own copy replaces both (with a warning when it replaces one
installed for every deck). Layouts are built in and may not be replaced;
within one place an id may appear only once per kind.

A theme or palette meant to be installed carries a few more settings in its
`extension.toml`: `version` (`1.0.0`), `author`, `license`, `homepage`, and
`mdeck = ">=X.Y.Z"`, the oldest mdeck it works with. What it needs follows
from its settings: a theme needs its default `palette`, and a palette with
`theme = "<id>"` needs that theme. Installing one installs what it needs;
removing a palette is refused while an installed theme uses it by default, and
removing a theme removes the palettes that belong only to it.

`mdeck themes install <theme>` and `mdeck palettes install <palette>` install
for every deck, into `themes/<id>/` or `palettes/<id>/` in the user's folder;
given a slide file, a folder or `--local`, into the `extensions/` folder
beside the deck (what it needs too, unless it is built in). Installing a
built-in one for every deck offers it again. A package holds only
`extension.toml` and, for a theme, `styles.css`. Theme fonts must come from
`https://fonts.googleapis.com/` or `https://fonts.bunny.net/`, and
`styles.css` may contain neither `@import` nor `url()` other than `data:`
URLs. Each installed folder gets a `.mdeck-package.json` with its kind, id,
version, source and a checksum of every file; `update` and `remove` refuse to
touch files changed since then unless given `--force`.

The repository serves `catalogue.json` (`{ schema: 2, themes: [...],
palettes: [...] }`, each with its id, version, default palette or theme,
`url`, `sha256`, `preview`, for a theme an `icon` (its title slide at
96×54, drawn at twice that for sharp screens), and `builtIn` for those that
come with mdeck) and
one JSON file per version holding the text of its files.
`mdeck themes build <repository> -o <out> [--check]` writes both from a
folder with `themes/` and `palettes/`; `MDECK_THEMES_URL` points mdeck at
another catalogue. Without a connection, mdeck offers its built-in ones.

## Listing what is available

```sh
mdeck list my-talk.md
mdeck list my-talk.md --json
```

The JSON form carries every manifest's title, description, tokens, parameters,
region requirements and property definitions, so other tools can build
controls from the same data mdeck uses.
