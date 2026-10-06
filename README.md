<p align="center">
  <img src="assets/logo/logo-light.svg" alt="mdeck" width="280">
</p>

<p align="center"><b>Write slides as a plain text file. Present them in the browser. Share them as one HTML file or a PDF.</b></p>

<p align="center">
  <a href="https://mdeck-996814.pages.fhnw.ch/">Docs</a> ·
  <a href="https://gitlab.fhnw.ch/tilman.schieber/mdeck/-/packages">Package</a> ·
  <a href="CHANGELOG.md">Changelog</a> ·
  <a href="LICENSE">MIT license</a>
</p>

> [!NOTE]
> **This is the `ink-annotate` branch** of a fork, based on mdeck **2.0.1**. It reworks drawing for presenting from an iPad with a pencil. Everything else is unchanged; see [What this branch changes](#what-this-branch-changes) below and the *Unreleased* section of the [changelog](CHANGELOG.md).

## What this branch changes

Drawing on slides (`D`) as it behaves in mdeck 2.0.1, and on this branch:

| | mdeck 2.0.1 | `ink-annotate` |
|---|---|---|
| Fingers while drawing | Draw until a pencil was used; slides change with keys or the presenter view's arrows | **Never draw** (unless the hand button is on); a **swipe** changes slides, a **tap** selects a stroke, buttons and polls on the slide keep working |
| Changing slides by touch | Tap zones, switched off on iPads that report a hovering pencil; they cover controls at the sides | **Swipe** left or right, read from pointer events: works on every touch screen, covers nothing |
| Pointing | *Marker*, a stroke that fades after a few seconds | **Laser pointer**: red glow with a white core, a trail that retracts within a second, a dot that follows a hovering pencil; shown live in the audience window and on paired devices, never saved |
| Highlighter | The pen's colours | Its own colours (yellow, green, pink, blue, orange), remembered apart from the pen's; always drawn **below** the pen |
| Changing strokes | Eraser, undo | Plus **select and move**: a lasso or a tap selects strokes, the pen drags them (saved, undoable), Delete removes them |
| Straight lines | – | Hold the pen still for 0.5 s at the end of a stroke: it becomes a straight line; tap it with a finger and drag its **end points** with the pen |
| Toolbar | One line | Colours and sizes only for pen and highlighter; **folds into one button** in the bottom right corner |
| Start | Pen; drawing off until `D` | **Laser**; on a touch screen drawing is on from the start, with the toolbar folded |
| Zoom | Safari's page zoom, which enlarges every bar | **Stage zoom**: two fingers zoom and move the slide itself (Ctrl + scroll on a laptop), bars keep their size, drawings stay exact, the audience window shows the same part; **1:1** or the next slide shows the whole slide |
| The page under the pencil | Could pan or bounce, in the presenter view too | Stays put while drawing |
| Stroke ends | Trail behind where the pen lifted | Reach the point where the pen lifted |
| Polls | Reset only on hover | `<poll answer="…">` adds a **tick button** that outlines the right answer in green, also in the audience window; **Reset** is always shown (not in the audience window) |
| With a standalone server and its key | Polls and the stage room (iPad ↔ audience window) go to the server | The stage room stays on `mdeck run`, **over the local network**; only polls and phones use the server |
| Audience window and paired iPad | Showed only the first stroke on a slide that got its id from that stroke | Fixed: the slide's new id reaches every window |

The drawings file format is unchanged. The main changes are in `src/runtime/deck-stage.js` (input, gestures, laser, zoom, straight lines), `src/runtime/ink/` (toolbar, selection in `select.js`, live messages), `src/live/server.js` (the local stage room) and `src/components/Poll.jsx`. `npm test` and `npm run test:browser` cover the new behaviour.

## A presentation is a text file

```markdown
---
theme: neue
meta:
  title: Enzyme kinetics
  author: Alex Morgan
---

---
layout: title
---
# Enzyme kinetics
## How fast, and why

---
# Rate depends on substrate

- Michaelis–Menten describes saturation
- *K*<sub>m</sub> is the half-saturation point

:::notes
Ask who has seen the curve before.
:::
```

Save that as `talk.md`, run `mdeck run talk.md`, and it is a slide deck with a
title slide, a content slide, a theme, and your notes in the presenter view.

<p align="center"><img src="docs/images/hero.png" alt="The tour deck's title slide in the Neue theme" width="800"></p>

## One file, any look

The same slide file rendered with each of the six built-in themes. Change one
line in the settings, or pick from the presenter view, and the whole deck
repaints.

<p align="center"><img src="docs/images/themes.gif" alt="The same slide cycling through the Aurora, Duet, Editorial, FHNW, Neue and Terminal themes" width="800"></p>

Try it yourself: the [docs home page](https://mdeck-996814.pages.fhnw.ch/)
embeds a live deck with a theme switcher.

## Install

You need [Node.js](https://nodejs.org) 22 or newer. mdeck is published in the
GitLab package registry of this project:

```sh
npm config set @tilman.schieber:registry https://gitlab.fhnw.ch/api/v4/packages/npm/
npm install -g @tilman.schieber/mdeck
mdeck --help
```

Working from a clone instead? See [CONTRIBUTING.md](CONTRIBUTING.md).

## First steps

```sh
mdeck new                    # answer a few questions, get a starter file
mdeck run talk.md            # launch page: present, edit, send and check; reloads on save
mdeck run talk.md --network  # also reachable from phones, e.g. for a poll
mdeck run talk.md --server   # present from an iPad on any network, through your server
mdeck build talk.md --reader # dist/ reader folder to host, notes removed
mdeck send talk.md           # one file to email, with a PDF inside
```

## What you get

- **Layouts:** title, chapter, big statement, image and text, split, full-bleed image, and plain content slides, with points that appear one at a time.
- **Looks:** six themes and eight colour palettes, changeable without touching the slides. Make your own as small `extension.toml` folders beside the deck.
- **One launch page:** `mdeck run` opens a page with a live preview, the presenter and audience views, the deck and reader views, the editor, the guides, one-click builds and PDF, the deck's check results, and for decks with a server its health and the presenter code.
- **Presenting:** a presenter view with notes and timer, and an audience window that stays in sync.
- **Drawing on slides:** pen with pressure, highlighter and a fading marker, with a mouse, a finger or an iPad pencil (`D`). Drawings are saved in `<deck>.drawings.json` beside the deck and appear in every view, build and PDF. An iPad can present on its own, or pair with the laptop through a QR code on the launch page while the laptop's audience window follows it.
- **Audience questions:** `<poll room="lunch" options="A|B|C" />` shows live results and a QR code; people vote on their phones. `<scale>`, `<wordcloud>` and `<question>` ask for a rating, words or open answers, and `<qrcode join />` shows the join code once for all of them. Rooms run inside `mdeck run --network` or on a small server (`mdeck server`).
- **Sharing:** a reader view with an outline, a phone-friendly Read mode and a PDF download; speaker notes are stripped from shared builds, and interactive slides appear in their finished state.
- **Content:** pictures, video, tables, callouts, code with syntax highlighting and live execution, formulas, QR codes, and your own Preact components, kept with one deck or shared between decks.
- **Editing in the browser** *(experimental)*: `mdeck edit talk.md` opens an editor with a live preview and forms for slides, settings, palettes, themes and layouts. It writes back into your text file.

## Read the docs

The docs are written for people who have never used Markdown:

- Online: <https://mdeck-996814.pages.fhnw.ch/>
- Offline, from any folder once mdeck is installed: `mdeck docs`

Technical references for layout, theme and tool authors live in
[docs/reference](docs/reference/).

## Write slides with an AI assistant

The package includes a `write-slides` skill that drafts a deck from a short
brief, checks it, and uses whatever layouts and looks your deck folder
provides. `mdeck skill --install claude codex cursor copilot gemini` puts it
where each assistant looks; `mdeck skill --print` gives it to any other tool.
See [docs/reference/claude-skill.md](docs/reference/claude-skill.md).

## Examples

Each example keeps its assets beside its slide source so it can be copied as a
complete folder.

| Example | What it demonstrates |
|---|---|
| [Tour](examples/showcase/slides.md) | Start here: each slide shows the Markdown beside what it becomes, from headings to layouts, live code, notes, drawing, a poll and sharing |
| [Python](examples/python/slides.md) | A real lesson: step-by-step live code, notes on every slide, a poll to check understanding |
| [FHNW](examples/fhnw/slides.md) | A short German deck in the FHNW theme |
| [Custom layouts](examples/custom-layouts/slides.md) | A deck-local comparison design and named regions |
| [Poll](examples/poll/slides.md) | A join slide, then a poll, a scale, a word cloud and open questions; start it with `mdeck run slides.md --network` |

## Made at FHNW

mdeck is developed at the School of Life Sciences FHNW for lectures, labs and
talks. Issues and ideas: <https://gitlab.fhnw.ch/tilman.schieber/mdeck/-/issues>.
