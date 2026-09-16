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
design: neue
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

Save that as `talk.md`, run `mdeck dev talk.md`, and it is a slide deck with a
title slide, a content slide, a theme, and your notes in the presenter view.

<p align="center"><img src="docs/images/hero.png" alt="The showcase deck's title slide in the Neue theme" width="800"></p>

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
mdeck new                 # answer a few questions, get a starter file
mdeck dev talk.md         # preview that reloads when you save
mdeck present talk.md     # presenter view with notes, timer and audience window
mdeck build talk.md       # dist/ folder to hand out or host
mdeck build talk.md --share --self-contained -o talk.html   # one file to email, with PDF
```

## What you get

- **Layouts:** title, chapter, big statement, image and text, split, full-bleed image, and plain content slides, with points that appear one at a time.
- **Looks:** six themes and eight colour palettes, changeable without touching the slides. Make your own as small `extension.toml` folders beside the deck.
- **Presenting:** a presenter view with notes and timer, and an audience window that stays in sync.
- **Sharing:** a reader view with an outline, a phone-friendly Read mode and a PDF download; speaker notes are stripped from shared builds.
- **Content:** pictures, video, tables, callouts, code with syntax highlighting and live execution, formulas, QR codes, and your own Preact components.
- **Editing in the browser** *(experimental)*: `mdeck edit talk.md` opens an editor with a live preview and forms for slides, settings, palettes, themes and templates. It writes back into your text file.

## Read the docs

The docs are written for people who have never used Markdown:

- Online: <https://mdeck-996814.pages.fhnw.ch/>
- Offline, from any folder once mdeck is installed: `mdeck docs`

Technical references for template, theme and tool authors live in
[docs/reference](docs/reference/).

## Write slides with Claude Code

The package includes a `/write-slides` skill for [Claude Code](https://claude.ai/code)
that drafts a deck from a short brief, checks it, and uses whatever layouts and
looks your deck folder provides. See [docs/reference/claude-skill.md](docs/reference/claude-skill.md).

## Examples

Each example keeps its assets beside its slide source so it can be copied as a
complete folder.

| Example | What it demonstrates |
|---|---|
| [Showcase](examples/showcase/slides.md) | Layouts and rich slide content |
| [FHNW](examples/fhnw/slides.md) | Slides using the FHNW theme |
| [Python](examples/python/slides.md) | A short introductory programming talk |
| [Custom templates](examples/custom-templates/slides.md) | A deck-local comparison design and named regions |

## Made at FHNW

mdeck is developed at the School of Life Sciences FHNW for lectures, labs and
talks. Issues and ideas: <https://gitlab.fhnw.ch/tilman.schieber/mdeck/-/issues>.
