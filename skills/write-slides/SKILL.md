---
name: write-slides
description: Write a complete mdeck slide deck. Use when the user asks to create slides, a presentation, or a talk using the mdeck framework, including turning existing PowerPoint, PDF, Word documents or notes into a deck, and when they want a new look for mdeck slides (a theme or colour palette, for example in their institute's colours).
license: MIT
compatibility: Best with the mdeck command installed (npm install -g mdeck); works without it using the quick reference.
allowed-tools: Read Write Bash(mdeck:*) Bash(npm root:*) Bash(ls:*)
metadata:
  argument-hint: "[source files, audience, length, language]"
  homepage: https://gh.tschieber.de/mdeck/
---

You are writing a presentation for mdeck, a slide framework that turns one Markdown file into slides with swappable themes and palettes.

## 1. Find the reference material

The mdeck docs are the source of truth for syntax, layouts and looks. Look for them in this order and read `authoring.md`, `themes.md` and `palettes.md` from the first place that exists:

1. `docs/reference/` in the current folder (you are inside the mdeck repository).
2. `$(npm root -g)/mdeck/docs/reference/` (mdeck is installed globally).

Read `examples/showcase/slides.md` from the same place as a complete working deck.

Then ask the installed mdeck what this deck can use, because a deck may ship its own layouts, themes and palettes in an `extensions/` folder:

```sh
mdeck list layouts <deck>.md --json  # every layout with its regions, settings and starter text
mdeck list <deck>.md                 # layouts, themes and palettes, built-in and local
```

If `mdeck` is not installed, rely on the quick reference below.

## 2. Quick reference

```markdown
---
theme: neue            # theme id from `mdeck list themes`
palette: nordic         # optional: swiss, nordic, neon, lagoon, graphite, or one installed from the theme repository (`mdeck themes search`)
appearance: light       # optional: light or dark
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
- Named areas use `:::slot name … :::`; the layout's regions and settings come from `mdeck list layouts --json`.
- `:::notes … :::` holds speaker notes. `:::steps … :::` reveals list items one at a time. `:::note`, `:::tip`, `:::important`, `:::warning` and `:::caution` are callouts (`mdeck check` warns about other names); for lectures, `:::definition`, `:::theorem`, `:::lemma`, `:::proof`, `:::example` and `:::remark`, numbered in the title (`::: theorem Theorem 2.4 (Lagrange)`). `:::columns … +++ … :::` makes columns inside a slide.
- Code fences get syntax highlighting; `$…$` and `$$…$$` render math.
- `<poll room="lunch" options="Mensa|Thai|Pizza" />` lets the audience vote on their phones through a QR code on the slide; each poll needs its own `room`. `<scale room="pace" min="1" max="5" low="Too slow" high="Too fast" />`, `<wordcloud room="mood" />` and `<question room="ask" />` ask for a rating, short words or open answers the same way. With several of them, put `<qrcode join />` (the deck's join code) on an early slide to show the QR code once, and add `qr="false"` to the questions. It works when the deck is presented with `mdeck run <deck>.md --network` or with a server set as `server:` in the deck settings.

## 3. Write the deck

The request is the message that invoked this skill: usually source material to turn into a deck, plus audience, length and language. If any of those are missing and matter, ask once, then write a complete deck.

**Source material**
- Most requests point at existing material: a `.pptx` or `.key` deck, a PDF (slides, a paper, a report), a `.docx`, Markdown or plain-text notes, spreadsheets. Read all of it before writing. If the request names no files, look in the deck's folder and ask whether to use what is there.
- Reuse the material's pictures: copy the ones you use into `./img/` with descriptive names. If you cannot open a file, say so.
- The material is the content. Keep its argument, order, facts, numbers, examples, terminology and citations; do not add claims, data or examples it does not contain. Your job is the deck: one idea per slide, statement headings, fitting layouts, detail moved from crowded slides into the notes, and notes written from the material's own text.
- Follow the requested degree of faithfulness. "Keep my wording" means light edits only; "tighten" or a time limit means cutting, and the cuts go into the notes or into your summary, not silently away.
- When rebuilding an old deck, keep its sequence unless asked otherwise, split slides that carry several ideas, and turn text-heavy slides into a few points with the rest in notes.
- Without any material, write the content yourself from the brief, and say clearly that it needs checking.

**Structure**
- Start with the deck settings: pick a `theme` and, if it suits the subject, a `palette` from the lists you gathered; fill in `meta.title`, `meta.author`, `meta.organization`, `meta.date`. For a talk that is not in English, set `lang` (for example `lang: de`).
- The first slide is `layout: title` with an `h1` headline and an `h2` subtitle.
- Use `layout: chapter` slides to divide major sections. End with a closing focus or title slide.

**Content**
- One idea per slide; if a third bullet is tempting, make it a new slide.
- Headings are statements, not labels ("Tokens decouple design from content", not "Design tokens").
- Use `layout: focus` for principles, quotes and conclusions; `layout: split` to pair code or an image with an explanation; `layout: full-bleed-image` only when a strong photograph carries the point.
- Add speaker notes to every content slide: context, transitions, what to emphasise.
- When the brief asks for audience interaction, add one or two polls at natural pauses, not more, and say in the notes how to present them.

**Formatting**
- `*italic*` renders in the accent colour; use it for key terms, not decoration.
- Keep lists to three to five items; prefer a short bold label plus one sentence over long bullets.
- Reference pictures under `./img/` and say which files the user still needs to add.

## 4. Check and hand over

Save the deck as a `.md` file named after the topic (for example `enzyme-kinetics.md`), then run:

```sh
mdeck check <deck>.md
```

Fix anything it reports. When you worked from source material, list what you left out or moved to notes, and anything you added that is not in the material. Finish by telling the user the two commands they will want next: `mdeck run <deck>.md` for the launch page (preview, presenting, editor, builds and checks), and `mdeck send <deck>.md` for a file to send around (a reader view with a PDF; notes are removed unless `--notes` is added).

## 5. A new look: themes and palettes

When the user wants a look the built-in themes and palettes do not give (their institute's colours, a font, the style of a poster or picture), first run `mdeck themes search` (with a word or two): someone may have shared it, and `mdeck themes install <pack> <deck>.md` puts it beside the deck, so the slide folder carries it. Otherwise make it as an extension in `extensions/` beside the deck, never as styling on single slides. Read `extensions.md` from the reference folder first; it lists every setting.

- **Colours only: a palette.** `extensions/<id>/extension.toml` with `kind = "palette"`, and every colour role (`--bg`, `--surface`, `--ink`, `--ink-soft`, `--muted`, `--rule`, `--accent`, `--accent-2`, `--on-accent`) in both `[light]` and `[dark]`. Text colours must stay readable on `--bg` and `--surface` in both variants, because themes use the other variant for inverted slides.
- **Fonts, sizes, spacing or arrangement: a theme.** Copy the folder of the closest built-in theme (`assets/extensions/themes/<id>/` in the mdeck repository or in `$(npm root -g)/mdeck/`) to `extensions/<new-id>/`, change `id` and `title`, then its tokens and `styles.css`. A theme takes no colours of its own: it names its default `palette`, and the colours come from palettes.
- **Use it:** set `theme:` and `palette:` in the deck settings. `mdeck list <deck>.md` must show it as local, and `mdeck check <deck>.md` reports any mistake in its `extension.toml`.
- **Hand over:** tell the user to run `mdeck design <deck>.md` (or `mdeck design <folder>` when there is no deck yet). It shows the look on a sample deck with every kind of slide, light and dark, and lets them fine-tune colours, fonts and sizes there.

