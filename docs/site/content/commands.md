# Command guide

Type these commands in a terminal. Replace `my-talk.md` with your own slide filename. If a folder or filename contains spaces, put the path in quotation marks.

## Everyday commands

| Command | Use it to… |
|---|---|
| `mdeck new` | Make a presentation with guided questions |
| `mdeck dev my-talk.md` | Open the launch page: present, edit, share and check from one place; slides reload when you save |
| `mdeck edit my-talk.md` | Edit slides, colors and designs in the browser; saves to the file |
| `mdeck present my-talk.md` | Open your slides with presenter notes and controls |
| `mdeck check my-talk.md` | Check settings and look for missing local files |
| `mdeck build my-talk.md` | Make a shareable presentation in the `dist` folder |
| `mdeck preview` | Open the last build from the current folder |
| `mdeck live` | Run a room server for polls in hosted presentations ([details](audience.html#use-it-in-a-real-session)) |
| `mdeck docs` | Open this documentation |
| `mdeck --help` | Show a short list of commands |

## The launch page

`mdeck dev my-talk.md` opens a page on your own computer with everything for this talk:

- **Present:** the presenter view, the full-screen deck and the reader view, each in a new tab.
- **Write and learn:** the visual editor and these guides. Each starts the first time you click it.
- **Share:** buttons that make the `dist` folder, one file to send, or a PDF, next to your slide file, and show them in your file manager.
- **Check:** the same problems `mdeck check` reports, such as missing pictures.
- **What you can use:** every layout with a starter to copy, the components, themes and colour palettes available to this deck.

Add `--host` to reach the slides from phones and tablets in the same network; the page then shows a QR code for the reader view. The launch page itself and its buttons only work on your own computer. `--port 4000` chooses the port and `--no-open` starts without opening a browser. `mdeck present` takes the same options and opens the presenter view instead.

## Open a particular guide

```sh
mdeck docs getting-started
mdeck docs sharing
```

Use the page name from its address, without `.html`. The welcome page is `index`.

`mdeck docs --no-open` starts the documentation server without opening a browser. `mdeck docs --port 4200` chooses a port number. If the usual port is busy, mdeck tries another one.

To make a static copy of the documentation site, use `mdeck docs --build`. This saves it in `docs/site/dist` inside the mdeck project, separately from your presentation builds.

## Edit in the browser

```sh
mdeck edit my-talk.md
mdeck edit my-talk.md --no-open
mdeck edit my-talk.md --port 4300
```

The editor opens in your browser and writes every change into the slide file. `--no-open` starts it without opening a browser window; `--port` chooses the port. See [Edit slides in your browser](editing.html).

## Sharing options

| Command | Result |
|---|---|
| `mdeck build my-talk.md -o talk.html` | Choose the output filename; local media stays alongside it |
| `mdeck build my-talk.md --inline-images` | Embed supported local image references in the HTML |
| `mdeck build my-talk.md --self-contained -o talk.html` | Embed local images and media in one HTML file |
| `mdeck build my-talk.md --presenter-launchers` | Include presenter launchers in the folder build |
| `mdeck build my-talk.md --share` | Open in the reader view, remove speaker notes, add a PDF (`--with-notes`, `--no-pdf`) |
| `mdeck build my-talk.md --pdf` | Also render `deck.pdf` next to the HTML |
| `mdeck pdf my-talk.md -o talk.pdf` | Render the slides to a PDF file |

`-I` is a short form of `--inline-images`. `-S` is a short form of `--self-contained`. See [Share or print your slides](sharing.html) for help choosing an option.

## Check more strictly

```sh
mdeck check my-talk.md --strict
```

The ordinary check fails when it finds an error. The strict check also fails when it finds a warning, such as a layout name it does not recognize.

The check does not measure whether text fits on the slide. Always look through the preview too.

## Reusable slide designs

```sh
mdeck templates my-talk.md
mdeck templates my-talk.md --starter comparison
```

The first lists the designs available to your talk. The second prints starting text for one design. `--json` prints the design descriptions in a structured form intended for other tools.

```sh
mdeck extensions my-talk.md
```

This lists every design, theme and color palette your talk can use, including any kept in an `extensions` folder beside it. `--json` prints the same information for other tools.

## Slides from an AI assistant

```sh
mdeck skill
mdeck skill --install claude codex
mdeck skill --print
```

Installs the slide-writing skill for the assistants you use, or prints it for any other tool. See [Write slides with an AI assistant](claude-skill.html).

## Why do some examples use Node directly?

`mdeck` is the normal command. After the one-time `npm link` setup, you can use it from any folder.

`node bin/mdeck.js` runs the same program directly from its project folder. It is useful when working on mdeck itself, but it is not a replacement you need to learn for everyday use.

From the project folder, `npm run dev -- my-talk.md` and `npm run build -- my-talk.md` are also available. These use the same program.
