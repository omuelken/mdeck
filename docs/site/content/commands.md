# Command guide

Type these commands in a terminal. Replace `my-talk.md` with your own slide filename; in a folder that has a `slides.md` you can leave it out. If a folder or filename contains spaces, put the path in quotation marks.

For how the commands, the views and the servers fit together, see [Views, commands and servers](views.html).

## Everyday commands

| Command | Use it to… |
|---|---|
| `mdeck new` | Make a presentation with guided questions |
| `mdeck run my-talk.md` | Open the launch page: present, edit, check and send from one place; slides reload when you save |
| `mdeck edit my-talk.md` | Edit slides, colors and themes in the browser; saves to the file |
| `mdeck check my-talk.md` | Check settings and look for missing local files |
| `mdeck send my-talk.md` | Make one file to send to readers, with a PDF inside |
| `mdeck build my-talk.md` | Make a folder to host in `dist` |
| `mdeck pdf my-talk.md` | Make a PDF |
| `mdeck preview` | Open the last build from the current folder |
| `mdeck server` | Run the server for polls and for presenting from an iPad on any network ([details](audience.html#use-it-in-a-real-session)) |
| `mdeck list`, `mdeck starter` | Look up layouts, themes and palettes |
| `mdeck docs` | Open this documentation |
| `mdeck --help` | Show a short list of commands |

## The launch page

`mdeck run my-talk.md` opens a page on your own computer with everything for this talk. It is what the preview's plain address, such as `http://localhost:5173/`, shows; the slides themselves are at `?view=deck`.

- **Preview:** a small live copy of the deck to flip through; click it to open the full-screen deck at that slide.
- **Present:** the presenter view and an audience window that follows it, the full-screen deck and the reader view, each in a new tab.
- **Write and learn:** the visual editor and these guides. Each starts the first time you click it.
- **Send:** buttons that make the `dist` folder, one file to send, or a PDF, next to your slide file, and show them in your file manager.
- **Polls:** for a deck with polls: the server (built in, or the `server` setting and whether it answers), the join link and session code for phones, and for a server of your own the key that lets your browser move the phones along and reset polls (see below).
- **Check:** the same problems `mdeck check` reports, such as missing pictures.

The key is the one the server was started with. Start `mdeck run` with the same key, for example `MDECK_SERVER_KEY=choose-a-secret mdeck run my-talk.md`, and the launch page shows it, and its presenter, audience and deck buttons open those views with it, so they move the phones along. The key is removed from the address as soon as a page has it. It never goes into the slide file, because that file reaches everyone who opens the slides.

Two options make the slides reachable from other devices:

| Option | What it does |
|---|---|
| `--network` | Phones and tablets on the same network can open the slides. |
| `--server` | An iPad on any network can present through your own server. It takes the server's address, or finds it in the deck's `server` setting or in the `MDECK_SERVER` variable, in that order. The key goes in `MDECK_SERVER_KEY`. |

See [Draw on your slides](drawing.html#present-from-an-ipad) for both. The launch page itself and its buttons only work on your own computer. `--port 4000` chooses the port and `--no-open` starts without opening a browser.

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

## Output options

| Command | Result |
|---|---|
| `mdeck build my-talk.md` | A folder in `dist` with every view, to host or copy |
| `mdeck build my-talk.md -o talk.html` | Choose the output filename; local media stays alongside it |
| `mdeck build my-talk.md --single-file -o talk.html` | Embed local images and media in one HTML file of the presentation |
| `mdeck build my-talk.md --launchers` | Include presenter launchers in the folder build |
| `mdeck send my-talk.md` | One file for readers: the reader view, speaker notes removed, a PDF inside |
| `mdeck send my-talk.md --notes` | The same, keeping the speaker notes |
| `mdeck send my-talk.md --no-pdf` | The same, without rendering the PDF |
| `mdeck pdf my-talk.md -o talk.pdf` | Render the slides to a PDF file |
| `--no-drawings` | Leave out the drawings from `my-talk.drawings.json`, for `build`, `send` and `pdf` |

See [Send, host or print your slides](sharing.html) for help choosing between them.

## Check more strictly

```sh
mdeck check my-talk.md --strict
```

The ordinary check fails when it finds an error. The strict check also fails when it finds a warning, such as a layout name it does not recognize.

The check does not measure whether text fits on the slide. Always look through the preview too.

## Layouts, themes and palettes

```sh
mdeck list layouts my-talk.md
mdeck starter comparison my-talk.md
```

The first lists the layouts available to your talk. The second prints starting text for one layout. `mdeck list layouts --json` prints the layout descriptions in a structured form intended for other tools.

```sh
mdeck list my-talk.md
mdeck list themes my-talk.md
```

The first lists every layout, theme and color palette your talk can use, including any kept in an `extensions` folder beside it. The second lists only themes; `palettes` works the same way. `--json` prints the same information for other tools.

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

From the project folder, `npm start -- my-talk.md` runs `mdeck run`, and `npm run build -- my-talk.md` builds. These use the same program.
