# Working on mdeck

```sh
git clone git@gitlab.fhnw.ch:tilman.schieber/mdeck.git
cd mdeck
npm install
npm link          # makes this checkout the `mdeck` command
npm test
```

## Repository layout

```text
bin/                 mdeck executable entry point
src/
  cli/               Commands, scaffolding, and packaging
  core/              Slide parsing, source ranges, validation, editing helpers
  runtime/           Browser app: deck stage, presenter, reader and editor preview
  editor/            Browser editor for decks, palettes, themes and templates
  components/        Built-in interactive content
  templates/         Shared rendering API, slide frame, typed properties
  extensions/        Manifest contract, discovery registry, appearance rules
  build/             Vite configuration, generated extension module, editing API, PDF
  paths.js           Locations of installed framework resources
assets/
  base.css           Shared slide CSS every theme builds on
  extensions/        Built-in templates, themes, and palettes (extension.toml each)
  logo/              Mark, wordmark and avatar
docs/
  site/              Documentation website and beginner guides
  reference/         Technical Markdown references
examples/            Complete example deck projects
playground/          Scratch deck and standalone development app
tests/               Automated regression tests (node --test)
tools/               Optional browser regression check
skills/              Distributable slide-authoring instructions
```

## Everyday commands

```sh
npm test                 # unit and integration tests
npm run test:browser     # optional real-Chrome check (set MDECK_CHROME if needed)
npm run playground       # scratch deck with hot reload
npm run docs:build       # build the documentation site into docs/site/dist
node bin/mdeck.js ...    # run the CLI from the checkout
```

The playground builds to `playground/dist/`; documentation builds to
`docs/site/dist/`. Both are ignored by Git. The user's `mdeck build` command
writes to `dist/` in the current working folder.

## Design rules

- Framework changes land here and reach decks through version bumps; do not
  patch example decks to work around framework bugs.
- Deck files are the single source of truth. Anything that edits them goes
  through the byte-preserving helpers in `src/core/editDeck.js`.
- Built-in templates, themes and palettes use the same `extension.toml` format
  as deck-local ones; there is no second registration path.
- The browser editor is experimental: keep its features behind `mdeck edit`
  and do not make presenting or building depend on it.

## Releasing

1. Update `CHANGELOG.md` and the version in `package.json`.
2. Commit, tag `vX.Y.Z`, push the tag.
3. The pipeline runs the tests, publishes the package to the GitLab package
   registry of this project, and deploys the documentation to GitLab Pages.
4. Create a release from the tag on GitLab with the changelog entry.

## License

MIT. See `LICENSE`.
