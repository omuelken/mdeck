---
name: write-slides
description: Write a complete mdeck slide deck. Use when the user asks to create slides, a presentation, or a talk using the mdeck framework.
license: MIT
compatibility: Best with the mdeck command installed (npm install -g @tilman.schieber/mdeck); works without it using the quick reference.
allowed-tools: Read Write Bash(mdeck:*) Bash(npm root:*) Bash(ls:*)
metadata:
  argument-hint: "[topic, audience, length, language]"
  homepage: https://mdeck-996814.pages.fhnw.ch/
---

You are writing a presentation for mdeck, a slide framework that turns one Markdown file into slides with swappable themes and palettes.

## 1. Find the reference material

The mdeck docs are the source of truth for syntax, layouts and looks. Look for them in this order and read `authoring.md`, `themes.md` and `palettes.md` from the first place that exists:

1. `docs/reference/` in the current folder (you are inside the mdeck repository).
2. `$(npm root -g)/@tilman.schieber/mdeck/docs/reference/` (mdeck is installed globally).

Read `examples/showcase/slides.md` from the same place as a complete working deck.

Then ask the installed mdeck what this deck can use, because a deck may ship its own designs in an `extensions/` folder:

```sh
mdeck templates <deck>.md --json     # every layout with its regions, settings and starter text
mdeck extensions <deck>.md           # themes and palettes, built-in and local
```

If `mdeck` is not installed, rely on the quick reference below.

## 2. Quick reference

```markdown
---
design: neue            # theme id from `mdeck extensions`
palette: paper          # optional palette id
meta:
  title: "Talk title"
  author: "Name"
  organization: "FHNW"
  date: "2026-09-16"
---

---
:::meta
layout: title
props:
  image: ./img/cover.jpg
:::
# Headline
## Subtitle

---
:::meta
layout: chapter
number: 1
part: Part One
:::
# Chapter title

---
# A content slide

- One point
- Another point

:::notes
What to say, what to skip, where to pause.
:::

---
:::meta
layout: split
props:
  ratio: [1, 2]
:::
# Shared heading

:::slot left
Left column
:::

:::slot right
Right column
:::
```

- Slides are separated by `---` on its own line. Settings go in a `:::meta` block at the top of a slide.
- Built-in layouts: `title`, `chapter`, `focus` (one big statement), `image-text`, `split`, `full-bleed-image`, and plain content slides without a `layout:`.
- Named areas use `:::slot name … :::`; the layout's regions and settings come from `mdeck templates --json`.
- `:::notes … :::` holds speaker notes. `:::steps … :::` reveals list items one at a time. `:::tip`, `:::warning`, `:::info` are callouts. `:::columns … +++ … :::` makes columns inside a slide.
- Code fences get syntax highlighting; `$…$` and `$$…$$` render math.

## 3. Write the deck

The request is the message that invoked this skill: topic, audience, length and language. If any of those are missing and matter, ask once, then write a complete deck.

**Structure**
- Start with the deck settings: pick a `design` and, if it suits the subject, a `palette` from the lists you gathered; fill in `meta.title`, `meta.author`, `meta.organization`, `meta.date`.
- The first slide is `layout: title` with an `h1` headline and an `h2` subtitle.
- Use `layout: chapter` slides to divide major sections. End with a closing focus or title slide.

**Content**
- One idea per slide; if a third bullet is tempting, make it a new slide.
- Headings are statements, not labels ("Tokens decouple design from content", not "Design tokens").
- Use `layout: focus` for principles, quotes and conclusions; `layout: split` to pair code or an image with an explanation; `layout: full-bleed-image` only when a strong photograph carries the point.
- Add speaker notes to every content slide: context, transitions, what to emphasise.

**Formatting**
- `*italic*` renders in the accent colour; use it for key terms, not decoration.
- Keep lists to three to five items; prefer a short bold label plus one sentence over long bullets.
- Reference pictures under `./img/` and say which files the user still needs to add.

## 4. Check and hand over

Save the deck as a `.md` file named after the topic (for example `enzyme-kinetics.md`), then run:

```sh
mdeck check <deck>.md
```

Fix anything it reports. Finish by telling the user the three commands they will want next: `mdeck dev <deck>.md` for the launch page (preview, editor, builds and checks), `mdeck present <deck>.md` to present, and `mdeck build <deck>.md --share --self-contained -o <deck>.html` for a file to send around (a reader view with a PDF; notes are removed unless `--with-notes` is added).
