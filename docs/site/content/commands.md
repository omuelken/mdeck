# Command guide

Type these commands in a terminal. Replace `my-talk.md` with your own slide filename. If a folder or filename contains spaces, put the path in quotation marks.

## Everyday commands

| Command | Use it to… |
|---|---|
| `mdeck new` | Make a presentation with guided questions |
| `mdeck dev my-talk.md` | Open a preview that reloads when you save |
| `mdeck present my-talk.md` | Open your slides with presenter notes and controls |
| `mdeck check my-talk.md` | Check settings and look for missing local files |
| `mdeck build my-talk.md` | Make a shareable presentation in the `dist` folder |
| `mdeck preview` | Open the last build from the current folder |
| `mdeck docs` | Open this documentation |
| `mdeck --help` | Show a short list of commands |

## Open a particular guide

```sh
mdeck docs getting-started
mdeck docs sharing
```

Use the page name from its address, without `.html`. The welcome page is `index`.

`mdeck docs --no-open` starts the documentation server without opening a browser. `mdeck docs --port 4200` chooses a port number. If the usual port is busy, mdeck tries another one.

To make a static copy of the documentation site, use `mdeck docs --build`. This saves it in `docs/site/dist` inside the mdeck project, separately from your presentation builds.

## Sharing options

| Command | Result |
|---|---|
| `mdeck build my-talk.md -o talk.html` | Choose the output filename; local media stays alongside it |
| `mdeck build my-talk.md --inline-images` | Embed supported local image references in the HTML |
| `mdeck build my-talk.md --self-contained -o talk.html` | Embed local images and media in one HTML file |
| `mdeck build my-talk.md --presenter-launchers` | Include presenter launchers in the folder build |

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

## Why do some examples use Node directly?

`mdeck` is the normal command. After the one-time `npm link` setup, you can use it from any folder.

`node bin/mdeck.js` runs the same program directly from its project folder. It is useful when working on mdeck itself, but it is not a replacement you need to learn for everyday use.

From the project folder, `npm run dev -- my-talk.md` and `npm run build -- my-talk.md` are also available. These use the same program.
