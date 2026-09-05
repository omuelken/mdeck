# Extensions: templates, themes and palettes

mdeck can be extended in three ways, and all three follow the same rules.

- A **template** is a slide layout: which content areas a slide has, which
  settings it accepts, and how it is arranged. Built-in layouts such as `title`
  and `split` are templates too.
- A **theme** is the overall look: fonts, spacing, the slide frame and the
  default colours. A deck picks one with `design:`.
- A **palette** is a set of colours that repaints any theme. A deck picks one
  with `palette:`.

Every extension is a folder with an `extension.toml` file inside. The manifest
says which kind it is and describes its supporting files and settings. The
folder name is the identifier used in slide files.

```text
extensions/
  comparison/          a template
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

The same registry backs `mdeck check`, `mdeck extensions`, `mdeck templates`,
the `mdeck new` wizard, the dev server and builds, so what a check accepts is
what a build can load.

## Shared settings

```toml
schema = 1              # manifest format version; always 1 for now
kind = "palette"        # template, theme or palette
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
extensions/ocean/extension.toml: tokens.accent: token names look like "--accent"
extensions/ocean/extension.toml:7:12: incomplete declaration: value expected
```

## Palette

```toml
schema = 1
kind = "palette"
id = "ocean"
title = "Ocean"
description = "Deep blue with a warm highlight."
dark = true

[tokens]
"--bg" = "#102030"
"--surface" = "#1c2a3c"
"--ink" = "#ffffff"
"--ink-soft" = "#d8e0ea"
"--muted" = "#8ea0b4"
"--rule" = "#2c3c50"
"--accent" = "#ffbd69"
"--accent-2" = "#7fd1c8"
"--on-accent" = "#102030"
```

`tokens` lists the CSS custom properties the palette overrides. The nine
tokens above are the shared vocabulary every theme uses; see
[palettes](palettes.md) for what each one does. `dark = true` marks a dark
palette so code colours and the logo are adjusted for a dark background.

## Template

```toml
schema = 1
kind = "template"
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

The layout file is Preact JSX that imports from `mdeck/template-api`. See
[templates](templates.md) for the renderer contract. Layout code runs as part
of the deck: it is trusted code, not sandboxed data.

## Theme

```toml
schema = 1
kind = "theme"
id = "my-theme"
title = "My theme"
description = "Calm sans-serif slides."
dark = false
accent2 = false              # true when the theme uses --accent-2
fonts = [
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap",
]

[files]
styles = "styles.css"        # one stylesheet or a list of them

[tokens]
"--bg" = "#ffffff"
"--surface" = "#f4f4f2"
"--ink" = "#111111"
"--ink-soft" = "#333333"
"--muted" = "#6b6b6b"
"--rule" = "#e2e2de"
"--accent" = "#2455c7"
"--fs-body" = "34px"
"--font-body" = "\"Inter\", system-ui, sans-serif"

[params.primaryColor]
token = "--accent"
title = "Primary color"

[params.fontBody]
token = "--font-body"
title = "Body font"
```

- `tokens` are the theme's default custom-property values. mdeck generates the
  `:root` block from them, so the stylesheet only contains rules, and the
  presenter's colour controls show the same defaults that are rendered.
- `params` name the settings authors may change under `params:` in the deck.
  Each points at a token; its default is the token's value, so nothing is
  written twice.
- `fonts` are stylesheet URLs loaded in normal builds. Self-contained builds
  skip them and use the fallbacks named in the token values.
- `dark = true` makes the theme dark by default. `accent2 = true` shows the
  second accent control; add `accent2Preview` when the `--accent-2` token is a
  CSS expression rather than a colour the control can display.

Values are applied in this order: theme tokens, palette tokens, deck `params`,
then the `accent` and `accent2` shorthands.

## Migrating an old template folder

Before this format, a deck-local template lived in `templates/<id>/` with a
`template.json`. Those folders still work and print a warning naming the file
and its replacement. To migrate:

1. Move `templates/comparison/` to `extensions/comparison/`.
2. Replace `template.json` with `extension.toml`. Add `schema = 1` and
   `kind = "template"`, rename `name` to `id`, and write `regions` and
   `properties` as TOML tables as shown above.
3. Keep `layout.jsx`, `styles.css` and `starter.md` where they are.
4. Run `mdeck check my-talk.md` until no warning remains.

Keeping both the old and the new folder for the same identifier is an error.
mdeck never rewrites your files. Support for `template.json` will be removed in
a later release; the removal will be announced in the command's warning first.

## Listing what is available

```sh
mdeck extensions my-talk.md
mdeck extensions my-talk.md --json
```

The JSON form carries every manifest's title, description, tokens, parameters,
region requirements and property definitions, so other tools can build
controls from the same data mdeck uses.
