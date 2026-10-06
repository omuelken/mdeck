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
