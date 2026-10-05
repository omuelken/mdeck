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
  editor/            Browser editor for decks, palettes, themes and layouts
  components/        Built-in interactive content, including the poll
  live/              Audience rooms: server, `mdeck/live` client, answer-page lookup, and the
                     server's relay for `--server` (tunnel.js; its other end is build/tunnelClient.js)
  home/              Launch page that `mdeck run` opens
  layouts/         Shared rendering API, slide frame, typed properties
  extensions/        Manifest contract, discovery registry, appearance rules
  build/             Vite configuration, component discovery, editing and launch
                     page APIs, deck check, PDF
  paths.js           Locations of installed framework resources
assets/
  base.css           Shared slide CSS every theme builds on
  extensions/        Built-in layouts, themes, and palettes (extension.toml each)
  logo/              Mark, wordmark and avatar
docs/
  site/              Documentation website and beginner guides
  reference/         Technical Markdown references
examples/            Complete example deck projects
playground/          Scratch deck and standalone development app
tests/               Automated regression tests (node --test)
tools/               Real-browser regression check (runs in CI)
skills/              Distributable slide-authoring instructions
```

## Everyday commands

```sh
npm test                 # unit and integration tests
npm run test:browser     # real-Chrome check, also run in CI (set MDECK_CHROME if needed)
npm run test:server       # `mdeck run --server` through a local server, with Chrome as the iPad
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
- Built-in layouts, themes and palettes use the same `extension.toml` format
  as deck-local ones; there is no second registration path.
- The browser editor is experimental: keep its features behind `mdeck edit`
  and do not make presenting or building depend on it.
- Local-only APIs (the editor, the launch page) answer loopback requests from
  their own pages only (`isAllowedRequest`). The server is the exception:
  phones must reach it, so it accepts any origin but keeps no personal data and
  lets only the presenter reset rooms.
- Components show their finished state inside `[data-deck-static]` (PDF,
  print, Read mode); built-in components must too.
- Tests that start a Vite server give it its own `cacheDir`, because test files
  run in parallel.

## Releasing

1. Update `CHANGELOG.md` and the version in `package.json`.
2. Commit, tag `vX.Y.Z`, push the tag.
3. The pipeline runs the tests, publishes the package to the GitLab package
   registry of this project, and deploys the documentation to GitLab Pages.
4. Create a release from the tag on GitLab with the changelog entry.

## License

MIT. See `LICENSE`.
