# mdeck

Make presentations from a plain-text file. mdeck turns your words into slides,
with ready-made layouts, themes, speaker notes, pictures, and video.

New to Markdown? Open the friendly step-by-step guides:

```sh
mdeck docs
```

## Set up this checkout

With Node.js and npm installed, run these commands in the project folder:

```sh
npm install
npm link
mdeck --help
```

`npm link` makes the `mdeck` command available from any folder. Run it again after
updating an older checkout if its command still points to the previous entry.

## Make a presentation

```sh
mdeck new
mdeck dev my-talk.md
mdeck edit my-talk.md
mdeck present my-talk.md
mdeck check my-talk.md
mdeck extensions my-talk.md
mdeck build my-talk.md
```

The preview updates when you save your slide file. `mdeck edit` opens a
visual editor in the browser that writes back into the same file, including
form-based editors for palettes, themes and slide templates. A normal build creates a
`dist/` folder with the HTML and referenced local media. Send the whole folder.
For one file, use:

```sh
mdeck build my-talk.md --self-contained -o my-talk.html
```

Online videos and live Python still need a network connection. Speaker notes
are included in built HTML even though the audience view hides them.

See all commands with `mdeck --help`, or open `mdeck docs commands`.

## Examples

Each example keeps its assets beside its slide source so it can be copied as a
complete folder.

| Example | What it demonstrates |
|---|---|
| [Showcase](examples/showcase/slides.md) | Layouts and rich slide content |
| [FHNW](examples/fhnw/slides.md) | Slides using the FHNW theme |
| [Python](examples/python/slides.md) | A short introductory programming talk |
| [Custom templates](examples/custom-templates/slides.md) | A deck-local comparison design and named regions |

```sh
mdeck dev examples/showcase/slides.md
mdeck dev examples/custom-templates/slides.md
```

## Documentation

```sh
mdeck docs
mdeck docs getting-started
mdeck docs --no-open
mdeck docs --build
```

The site lives in [docs/site](docs/site/) and builds to `docs/site/dist/`.
Technical references live in [docs/reference](docs/reference/):

- [Authoring reference](docs/reference/authoring.md)
- [Structured slides and source model](docs/reference/structured-slides.md)
- [Extensions: one manifest for templates, themes and palettes](docs/reference/extensions.md)
- [Custom templates](docs/reference/templates.md)
- [Themes](docs/reference/themes.md) and [palettes](docs/reference/palettes.md)
- [Slide-writing skill](docs/reference/claude-skill.md)

## Repository layout

```text
bin/                 mdeck executable entry point
src/
  cli/               Commands, scaffolding, and packaging
  core/              Slide parsing, source ranges, and validation
  runtime/           Browser app, navigation, theme loading, editor preview mode
  editor/            Browser editor for decks, palettes, themes and templates
  components/        Built-in interactive content
  templates/         Shared rendering API, slide frame, and typed properties
  extensions/        Manifest contract, discovery registry, appearance rules
  build/             Vite configuration, the generated extension module, editing API
  paths.js           Locations of installed framework resources
assets/
  base.css           Shared slide CSS every theme builds on
  extensions/        Built-in templates, themes, and palettes (extension.toml each)
docs/
  site/              Documentation website and beginner guides
  reference/         Technical Markdown references
examples/            Complete example deck projects
playground/          Scratch deck and standalone development app
tests/               Automated regression tests
tools/               Optional development utilities
skills/              Distributable slide-authoring instructions
```

Deck-local `components/` and `extensions/` folders remain beside the author's
slide file. Built-in and deck-local extensions share one manifest format and
one registry; see [docs/reference/extensions.md](docs/reference/extensions.md).
The template import `mdeck/template-api` stays the same.

## Working on mdeck

```sh
npm test
npm run playground
npm run playground:build
npm run docs:build
```

The playground builds to `playground/dist/`; documentation builds to
`docs/site/dist/`. Both are ignored by Git. The user's `mdeck build` command
continues to write to `dist/` in the current working folder.

For direct checkout execution, use `node bin/mdeck.js`. The npm `dev`, `build`,
`present`, and `preview` workflows call that same entry point.

An optional `npm run test:browser` checks presenter/audience synchronization in
Chrome or Chromium. Set `MDECK_CHROME` if needed. It is separate from `npm test`.
