---
description: Write a complete mdeck slide deck. Use when the user asks to create slides, a presentation, or a talk using the mdeck framework.
argument-hint: [topic and audience]
allowed-tools: Read Write
---

You are writing a presentation using the mdeck slide framework — a Markdown-driven slide system with swappable themes and palettes.

Read these files before writing any slides:

- `docs/reference/authoring.md` — layouts, frontmatter fields, markdown elements, components, callouts, speaker notes
- `docs/reference/palettes.md` — available color palettes and the token system
- `docs/reference/themes.md` — available themes and configuration

If the deck folder has an `extensions/` folder, run `mdeck extensions <deck>.md` (or read its manifests) to learn about local templates, themes and palettes before choosing `design`, `palette` or a `layout`.

Also read `examples/showcase/slides.md` as a complete working reference deck.

Then write a complete mdeck slide deck for the following request:

$ARGUMENTS

**Structure**
- Open with a deck frontmatter block: choose an appropriate `design` and `palette`, fill in `meta.title`, `meta.author`, `meta.organization`, `meta.date`
- First slide must be `layout: title` with an `h1` headline and `h2` subtitle
- Use `layout: chapter` slides to divide major sections
- End with a closing title or focus slide

**Content**
- One idea per slide — if a third bullet is tempting, make it a new slide
- Slide headings are statements, not labels ("Tokens decouple design from content" not "Design tokens")
- Use `layout: focus` for key principles, quotes, or conclusions
- Use `layout: split` when pairing a code block or image with an explanation
- Use `layout: full-bleed-image` only when a strong photograph carries the point
- Add speaker notes using `:::notes ... :::` blocks with context, transitions, and things to emphasise

**Formatting**
- `*italic*` renders in the accent color — use it for key terms, not decoration
- Keep bullet lists to 3–5 items maximum
- Prefer a short bold label + one sentence over long prose bullets

**Practical defaults**
- Prefer built-in layouts from the authoring docs (`title`, `chapter`, `focus`, `image-text`, `split`, `full-bleed-image`)
- Use local image paths under `./img/` when referencing visuals
- If the user asks for a single-file shareable output, mention `mdeck build <file>.md --inline-images`

Write the result to a `.md` file named after the topic (e.g. `my-talk.md`).
