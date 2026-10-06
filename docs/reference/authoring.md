# Authoring slides

Decks are plain Markdown files. You can version them in git, open them in any text editor, and diff them like code.

---

## Deck structure

A deck is a single `.md` file. The first block is the **deck frontmatter** — it configures the whole presentation. Each subsequent `---` separator starts a new slide.

```markdown
---
theme: neue
palette: paper
meta:
  title: "My Talk"
  author: "Jane Smith"
  organization: "Acme"
  date: "2026-05-19"
  logo: ./img/logo.png
width: 1920
height: 1080
---

---
layout: title
---
# First slide.
## A short subtitle.

---
# Second slide.

Some body text here. No frontmatter needed for plain content slides.
```

Each `---` line starts a new slide. Frontmatter is only needed when you want a specific layout or slide metadata (`section`, `note`, `image`, etc.). Plain content slides can follow the `---` separator directly with their markdown content.

### Deck frontmatter fields

| Field | Default | Description |
|---|---|---|
| `theme` | `neue` | Theme name |
| `palette` | _(theme default)_ | Color palette override |
| `accent` | _(theme/palette default)_ | Primary accent color override |
| `accent2` | _(theme/palette default)_ | Secondary accent color (themes with a second accent, such as Aurora and Duet) |
| `meta.title` | — | Deck title (shown in footer) |
| `meta.author` | — | Author name (shown in footer) |
| `meta.organization` | — | Organization name (shown in header) |
| `meta.date` | — | Date string (shown in footer) |
| `meta.logo` | — | Path to logo image |
| `width` / `height` | `1920` / `1080` | Slide canvas dimensions in px |
| `show.organization` | `title` | When to show the organization name: `title`, `all`, or `none` |
| `show.author` | `title` | When to show the author and date line: `title`, `all`, or `none` |
| `show.numbers` | `slides` | Slide numbers: `slides` (all except title), `all`, or `none` |
| `show.sections` | `all` | Whether to show section labels in the header: `all` or `none` |
| `lang` | `en` | Language of the deck, such as `en`, `de` or `de-CH`: sets the page language and the words the audience sees (see below) |
| `labels` | — | Replace single words the audience sees (see below) |
| `callouts` | — | Override individual callout titles (see below) |
| `server` | the dev server | Your own server for polls, other audience activities and presenting from an iPad, e.g. `https://rooms.example.org` |
| `session.id` | from the title | Name the session code is derived from |
| `session.code` | from `session.id` | The session code itself, 4 to 8 digits; phones join at `<server>/<code>` |
| `components` | — | Extra folders of Preact components shared between decks, relative to the deck or starting with `~/` |
| `params` | — | Theme-specific color/font overrides (see below) |
| `reader.themes` | `true` | Whether the reader view offers other themes and palettes (see below) |
| `reader.notes` | `false` | Whether the reader view shows speaker notes under each slide in Read mode |

### Theme params

Some themes expose configurable tokens. Set them under `params:`:

```yaml
params:
  primaryColor: "#e63946"
  backgroundColor: "#fafafa"
```

Available params depend on the theme — check the presenter sidebar for a list.

---

### Reader settings

```yaml
reader:
  themes: false   # hide the theme and color picker in the reader view
  notes: true     # show speaker notes under each slide in Read mode
```

Views are chosen with one address parameter: `?view=deck`, `?view=reader`,
`?view=presenter` or `?view=audience`. `mdeck send` produces a file that opens
in the reader view (outline, Read mode, look picker, PDF download).
`reader.themes: false` keeps the sender's look fixed. Speaker notes are
removed from `mdeck send` files unless the command uses `--notes`, and even
then the reader shows them only when `reader.notes` is `true`, so a file can
carry notes for the presenter view without showing them to readers. The same
view is reachable in any build through `?view=reader`.

## Available themes

| Key | Description |
|---|---|
| `neue` | Clear sans-serif type (Inter Tight and Inter), warm stone background, teal accent |
| `aurora` | Geometric shapes, Plus Jakarta Sans, violet accent with a derived magenta second accent |
| `duet` | Zilla Slab headings with DM Sans body; two accents for structure and voice |
| `editorial` | Magazine look, Playfair Display headings and Lora body, warm crimson accent |
| `fhnw` | The FHNW corporate design: Inter, black on white, yellow accent areas |
| `terminal` | Dark by default, JetBrains Mono throughout, terminal green accent |

`mdeck list <deck>.md` lists these together with any themes kept beside
the deck.

---

## Available palettes

| Key | Style |
|---|---|
| `paper` | Clean white |
| `sage` | Muted sage green |
| `mono` | Pure monochrome |
| `terra` | Warm sand and red |
| `dark-slate` | Dark cool blue |
| `dark-ember` | Dark warm amber |
| `dark-neon` | Dark vivid neon |
| `dark-mono` | Dark neutral grey |

---

## Slide frontmatter

Each slide can have its own frontmatter block immediately after the `---` separator. Frontmatter is only needed when a slide has specific metadata — layout, image, explicit section label, etc. Plain content slides can omit it entirely.

```markdown
---
layout: chapter
number: 1
part: Part One
description: A short description shown under the title.
---
# Chapter title.
```

### Common slide fields

| Field | Description |
|---|---|
| `layout` | Slide layout (see below) |
| `section` | Section label shown in the slide header (auto-propagated — see below) |
| `title` | Name in the outline and reader navigation, for slides without a heading (not shown on the slide) |

### Section labels

The `section:` field labels the top-right corner of the slide header. It auto-propagates: once set on a slide, all subsequent slides inherit it until a new `section:` is declared or a new chapter starts.

`chapter` slides automatically set the current section to their `part:` value, so slides within a chapter inherit the chapter name without needing explicit `section:` fields.

```markdown
---
layout: chapter
number: 1
part: Methodology
---
# Chapter title.

---
# First slide.
This slide automatically shows "Methodology" in the header.

---
section: Results
---
# Second slide.
This slide shows "Results" — and so does every slide after it until the next chapter or section override.
```

### Speaker notes

Speaker notes are only visible in the presenter view. Use a `:::notes` fenced block anywhere in the slide body — typically at the end:

```markdown
---
layout: focus
eyebrow: Key point
---
# The main statement.

:::notes
This is the central idea. Pause here.

- Bullet one
- Bullet two
:::
```

Notes support full Markdown and are written only in `:::notes` blocks in the slide body.

---

## Layouts

### `title` — Opening slide

Centered headline and subtitle. The `h1` becomes the display headline; `h2` becomes the italic subtitle.

```markdown
---
layout: title
---
# A clean presentation framework.
## Markdown-driven slides with *swappable* design systems.
```

---

### `chapter` — Section divider

Ghost numeral, a short accent rule, chapter label, title, and optional description.

```markdown
---
layout: chapter
number: 1
part: Part One
description: How content, design, and components fit together.
---
# The three-part architecture.
```

| Field | Description |
|---|---|
| `number` | The large ghost numeral |
| `part` | Small uppercase label above the title |
| `description` | Italic description below the title |

---

### `focus` — Statement or quote

Left-aligned large statement with an optional eyebrow label and attribution line.

```markdown
---
layout: focus
eyebrow: Core principle
attribution: Tilman Schieber
---
# Separate *content* from *design* from behaviour.
```

| Field | Description |
|---|---|
| `eyebrow` | Small uppercase label above the statement |
| `attribution` | Small italic credit below |

---

### `image-text` — Image beside text

Left image pane, right text pane.

```markdown
---
layout: image-text
image: ./img/diagram.jpg
section: Architecture
---
## Tokens all the way down.

Change one value and the *whole deck* repaints.
```

| Field | Description |
|---|---|
| `image` | Path to image file |
| `section` | Header label |

---

### `full-bleed-image` — Photograph edge-to-edge

The `h1` appears as a caption over a dark gradient at the bottom of the image.

```markdown
---
layout: full-bleed-image
image: ./img/photo.jpg
---
# A caption over the photograph.
```

---

### `split` — Component beside text

The first block element in the body (any component, image, or paragraph) goes to the left pane; everything else flows to the right.

```markdown
---
layout: split
---
```js
const fib = n => n < 2 ? n : fib(n - 1) + fib(n - 2)
```

# Split layout.
The code block goes left. This heading and text go right.
```

---

### Generic (no layout) — Content slide

No `layout:` field renders a standard content slide. `h1` is the heading; everything below is body content. Frontmatter is optional — omit it entirely for slides that need no metadata:

```markdown
---
# Three key principles

1. **Simplicity** — one idea per slide
2. **Contrast** — separate layers
3. **Rhythm** — consistent spacing
```

Add frontmatter only when you need slide-level metadata:

```markdown
---
section: Content
---
# Three key principles

1. **Simplicity** — one idea per slide
2. **Contrast** — separate layers
3. **Rhythm** — consistent spacing
```

---

## Markdown elements

### Headings

`h1` is the slide heading. `h2` is a subheading. Avoid going deeper — slide typography is not designed for `h3`–`h6`.

### Emphasis

- `*italic*` or `_italic_` → italic, colored in the accent color
- `**bold**` or `__bold__` → bold, in the primary ink color

### Lists

Unordered lists render with a short accent rule as the bullet. Ordered lists use large ghost numerals.

```markdown
- First item
- Second item

1. First step
2. Second step
```

### Footnotes

Define footnotes inline. They render as a small block above the slide footer.

```markdown
This claim needs a source.[^1]

[^1]: The source citation goes here.
```

---

## Code blocks

Fenced code blocks are syntax-highlighted. Add flags after the language name for extra behavior:

````markdown
```js live editable copy
const fib = n => n < 2 ? n : fib(n - 1) + fib(n - 2)
console.log(fib(10))
```
````

| Flag | Effect |
|---|---|
| `live` | Adds a Run button; captures `console.log` output below the block |
| `editable` | Makes the block editable in-browser |
| `copy` | Adds a clipboard copy button |

Supported languages include `js`, `python`, `css`, `html`, `json`, `bash`, and any other Prism-supported language.

> Python requires Pyodide, which loads on first run (~10 MB). JavaScript runs instantly in a sandboxed `Function`.

---

## Tables

Standard GFM table syntax:

```markdown
| Layer     | Format   | Who owns it |
|-----------|----------|-------------|
| Content   | Markdown | Author      |
| Design    | CSS      | Designer    |
| Behaviour | Preact   | Developer   |
```

---

## Math

Inline math: `$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$`

Block math:

```markdown
$$
\int_0^\infty e^{-x^2}\,dx = \frac{\sqrt{\pi}}{2}
$$
```

---

## Callouts

Use `:::` fences with a type keyword. An optional custom title follows the type on the same line.

```markdown
::: note
Use callouts sparingly — one per slide at most.
:::

::: tip Combine with code
Place next to a code block for step-by-step instructions.
:::

::: warning
Callouts interrupt reading flow.
:::
```

Available types: `note`, `tip`, `important`, `warning`, `caution`.

### Callout titles

Without a custom title, a callout is labelled after its type. Set `lang: de` in the deck frontmatter to get German defaults (`Hinweis`, `Tipp`, `Wichtig`, `Achtung`, `Vorsicht`), or override individual titles:

```yaml
lang: de
callouts:
  warning: "Vorsicht, Falle"
```

A title written after the type on the `:::` line still wins over both.

---

## Language

`lang` is the language of the whole deck. The page is marked with it, so screen readers pronounce the slides correctly and browsers hyphenate them. It also picks the words mdeck itself shows the audience: the reader view's buttons, the deck's control bar, polls on the slide and on phones, and callout titles. German (`de`) and English (`en`) are built in; for any other language the words stay English. A regional code such as `de-CH` uses the German words.

The presenter view, the launch page and the editor are tools for the author and always stay English.

To change single words, name them under `labels`:

```yaml
lang: de
labels:
  poll.scan: "Jetzt abstimmen"
  reader.present: "Vollbild"
```

`mdeck check` warns about names that do not exist. `{n}`, `{choice}`, `{command}` and `{setting}` are filled in by mdeck.

| Label | English | German |
|---|---|---|
| `reader.outline` | Outline | Gliederung |
| `reader.untitled` | Slides | Folien |
| `reader.slides` | Slides | Folien |
| `reader.read` | Read | Lesen |
| `reader.look` | Look | Aussehen |
| `reader.theme` | Theme | Design |
| `reader.colors` | Colors | Farben |
| `reader.themeColors` | Default | Standard |
| `reader.resetLook` | Reset to default | Zurücksetzen |
| `reader.resetLookHint` | Return to the look the deck was made with | Zum ursprünglichen Aussehen zurück |
| `reader.senderLook` | This is the look the deck was made with | Das ist das ursprüngliche Aussehen |
| `reader.downloadPdf` | Download PDF | PDF herunterladen |
| `reader.savePdf` | Save as PDF… | Als PDF sichern… |
| `reader.savePdfHint` | Opens the browser's print dialog; choose Save as PDF | Öffnet den Druckdialog des Browsers; dort „Als PDF sichern“ wählen |
| `reader.present` | Present | Präsentieren |
| `reader.previous` | Previous | Zurück |
| `reader.next` | Next | Weiter |
| `reader.copyLink` | Copy link to this slide | Link zu dieser Folie kopieren |
| `reader.linkCopied` | Link copied | Link kopiert |
| `reader.slide` | Slide {n} | Folie {n} |
| `deck.overview` | Overview | Übersicht |
| `deck.controls` | Deck controls | Foliensteuerung |
| `deck.previous` | Previous slide | Vorherige Folie |
| `deck.next` | Next slide | Nächste Folie |
| `deck.reset` | Reset | Neustart |
| `deck.resetHint` | Reset to first slide | Zurück zur ersten Folie |
| `poll.scan` | Scan to vote | Scannen und abstimmen |
| `poll.answer` | 1 answer | 1 Antwort |
| `poll.answers` | {n} answers | {n} Antworten |
| `poll.reset` | Reset | Zurücksetzen |
| `poll.live` | Live | Live |
| `poll.offline` | Not connected to the server | Keine Verbindung zum Server |
| `poll.unreachable` | Phones cannot reach this computer. Start with {command}, or set {setting}. | Handys erreichen diesen Computer nicht. Mit {command} starten oder {setting} setzen. |
| `poll.tryHere` | Try the answer page here | Antwortseite hier ausprobieren |
| `poll.pick` | Tap one answer. | Eine Antwort antippen. |
| `poll.thanks` | Thanks! You chose “{choice}”. Tap another to change. | Danke! Gewählt: „{choice}“. Zum Ändern eine andere antippen. |
| `respond.waiting` | The next question will appear here. | Die nächste Frage erscheint hier. |
| `respond.send` | Send | Senden |
| `respond.sent` | Sent. Thank you! | Gesendet. Danke! |
| `join.scan` | Scan to join | Scannen und mitmachen |
| `question.empty` | Answers appear here. | Hier erscheinen die Antworten. |
| `scale.average` | Average {n} | Durchschnitt {n} |

---

## Speaker notes

Use a `:::notes` fenced block in the slide body. Notes support Markdown and are only visible in the presenter view:

```markdown
---
layout: focus
eyebrow: Key point
---
# The main idea.

:::notes
This is the central design decision. Pause here.

- **Content** is readable without tooling
- **Design** is just a CSS file
- Ask: *"what breaks if you swap the theme?"*
:::
```

The `:::notes` block can appear anywhere in the body, but placing it last keeps it visually separate from slide content.

---

## Columns

Place content side by side using `:::columns` with `+++` as the column separator:

```markdown
:::columns

Left column content here.

+++

Right column content here.

+++

A third column, if needed.

:::
```

Each column is an equal-width flex child, so three `+++` separators give four equal columns. Use `:::columns` inside any layout that has a body area — `GenericSlide`, `focus`, etc.

---

## Images

Reference images with standard Markdown syntax or the `image:` frontmatter field. Paths are relative to the deck file.

```markdown
![Alt text](./img/diagram.png)
```

A normal build copies referenced local images, video, and audio next to the HTML
while preserving their deck-relative paths. This is the recommended distribution
format for decks containing substantial video.

To embed all local images and media in a single offline-ready HTML file, use:

```bash
mdeck build slides.md --single-file -o slides.html
```

Theme web fonts are replaced by their declared system-font fallbacks in this mode.
Self-contained video is base64-encoded and is therefore roughly 33% larger than
the source file; loading, memory use, and seeking can also be worse than with a
separate media file.

To add target-computer launchers to a directory bundle, build with
`--launchers`. The generated `present.sh` (macOS/Linux),
`present.bat`, and `present.ps1` (Windows) require Python 3, start a local server
bound to `127.0.0.1`, and open the presenter view in the default browser.

---

## Video

Embed video with the `<videoplayer>` component. It accepts local files and web video URLs.

```markdown
<!-- Local file — click to play (default) -->
<videoplayer src="./demo.mp4" />

<!-- Autoplay when slide becomes active (muted, as required by browsers) -->
<videoplayer src="./demo.mp4" play="auto" />

<!-- YouTube, Vimeo, or SwitchTube URL -->
<videoplayer url="https://youtu.be/dQw4w9WgXcQ" />
<videoplayer url="https://tube.switch.ch/videos/abc123" play="auto" />
```

| Attribute | Default | Description |
|---|---|---|
| `src` | — | Path to a local video file |
| `url` | — | Web video URL (YouTube, Vimeo, SwitchTube, or direct embed URL) |
| `play` | `click` | `click` — user controls playback; `auto` — plays when slide activates, pauses when leaving |
| `aspect` | `16/9` | CSS `aspect-ratio` value, e.g. `4/3` |
| `muted` | — | Mute the video (always muted in `auto` mode) |

For `play="auto"` the video pauses and resets to the beginning when you navigate away. Local videos also pause automatically on slide leave in `click` mode to avoid unexpected audio.

---

## Polls

`<poll>` asks the audience a question they answer on their phones:

```markdown
# Where do we eat?

<poll room="lunch" options="Mensa|Thai|Pizza|Salad" />
```

| Attribute | Default | Description |
|---|---|---|
| `room` | `poll` | Name of the room that collects the answers; unique per poll in a deck. Letters, digits, `.`, `-`, `_` |
| `options` | — | Answers separated by `\|` |
| `question` | — | Question text; phones fall back to the slide heading |
| `qr` | `true` | `false` leaves out the QR code (shown earlier with `<qrcode join />`) |

Three more activities take the same `room`, `question` and `qr`:

| Tag | Attributes | Phones | Slide |
|---|---|---|---|
| `<scale>` | `min` (1), `max` (5), `low`, `high` | One button per number, `low`/`high` as labels | Count per number and the average; latest answer per device |
| `<wordcloud>` | `placeholder`, `limit` (60), `height` (520) | Text field, up to 40 characters, repeatable | A packed word cloud (d3-cloud): size by frequency, some words upright, case-insensitive |
| `<question>` | `placeholder`, `limit` (8) | Text field, up to 200 characters, repeatable | The newest answers as cards |

`<qrcode join />` shows the deck's join code large with its link (`size`, default 420), for a slide that invites everyone once; activities after it can use `qr="false"`. QR codes (`<qrcode>`, activities) are SVG in the slide's `--ink` on a transparent background; `--qr-ink` and `--qr-bg` override the colours.

The slide shows live bars, the number of answers, a QR code and a short link. Phones never load the deck: they open the server's own answer page at `<server>/<code>`, where the six-digit session code is the same for every poll in the deck. The presenter's screen (the presenter view or a full deck window, never an embedded preview) announces the poll on the current slide with what the phones should show and the deck's look; the server only accepts that from the presenter. Between polls the phones wait. Each device's latest vote counts. The presenter can reset the room (hover over the results).

Rooms run inside `mdeck run` (add `--network` so phones can reach it) or on a server started with `mdeck server`, set in the deck:

```yaml
server: https://rooms.example.org   # your server; phones join at https://rooms.example.org/<code>
session:
  id: talk                          # optional: name the code is derived from, defaults to the title
  code: 482113                      # optional: the code itself
```

A deck's rooms are named `<code>.<room>` on the server, so decks sharing a server stay apart. See the [Ask your audience](../site/content/audience.md) guide for hosting, and [Create interactive content](../site/content/components.md) for writing other activities with `useRoom` and a `phone` description.

---

## Drawings (ink)

Drawings on slides live in `<deck>.drawings.json` beside `<deck>.md` and are part of every view, build and PDF (`--no-drawings` leaves them out). `mdeck run` saves them as they are drawn; the guide [Draw on your slides](../site/content/drawing.md) covers drawing and presenting from an iPad.

```json
{
  "version": 1,
  "width": 1920,
  "height": 1080,
  "slides": {
    "the-important-part": [
      {"id":"k3f9a2:lq1x0","tool":"pen","color":"#e11d48","size":6,"points":[[412,630,0.52],[598,641,0.61]]}
    ]
  }
}
```

- Keys under `slides` are slide ids. A slide without an `id:` gets one from its heading when it receives its first drawing, written into its settings.
- `points` are `[x, y, pressure]` in the deck's design pixels (`width` × `height`); if the deck's size changes, strokes are scaled. `tool` is `pen` or `highlighter`.
- Drawings belong to a slide, not to a step of it.
- `mdeck check` reports a broken drawings file and drawings for slide ids that are not in the deck.
- Keys: `D` draw, `I` hide or show drawings, `F` full screen.

## Deck-local components

Components registered in `src/runtime/registry.jsx` are part of *every* deck. When a
widget is only needed by one talk, put it in a `components/` folder next to the
deck file instead:

```
my-talk/
  my-talk.md
  components/
    Tokenizer.jsx
```

Each `*.jsx` file's default export is registered automatically under its
lowercased filename, so `Tokenizer.jsx` becomes `<tokenizer>`:

```markdown
<tokenizer text="Donaudampfschifffahrt" />
```

Attributes arrive as props, exactly like built-in components. Deck-local
components override a built-in of the same name.

To reuse components across decks, list their folders in the deck settings:

```yaml
components:
  - ../shared-components
  - ~/mdeck-components
```

The deck's own `components/` folder is searched first, then the listed folders
in order, then the built-ins. `mdeck check` reports listed folders that do not
exist.

In PDFs, printouts and the reader's Read mode, every slide is shown at once.
There mdeck reveals all steps and places the slide inside an element with the
`data-deck-static` attribute; a component that builds up step by step should
render its finished state inside `[data-deck-static]`, and follow the stage's
`printchange` event for printing started from an open deck. A slide that holds
only a component can be named for the outline with a `title:` setting.

Because they are only pulled in by the deck that ships them, a heavy dependency
stays out of every other deck's bundle. Install such dependencies in a
`node_modules` next to the deck, or in the framework itself.

> Deck components are `.jsx` only, and are written against Preact — import
> hooks from `preact/hooks`. The build resolves those imports back to the
> framework's own Preact, so the deck folder needs no Preact install.

---

## Inline HTML

You can write HTML directly in slide bodies. It inherits the theme's body text styles automatically. Use it for structural layouts the framework doesn't provide out of the box:

```markdown
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 48px;">
  <div>Left column content</div>
  <div>Right column content</div>
</div>
```
