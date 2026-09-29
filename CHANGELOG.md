# Changelog

## Unreleased

- PDFs, printouts and the reader's Read mode show interactive slides in their finished state. Every step is revealed and the slides sit inside `[data-deck-static]`; the stage dispatches a `printchange` event when printing starts or ends. CSS transitions are off in print.
- Up to date dependencies with no known vulnerabilities: Vite 8, marked 18, KaTeX 0.18, js-yaml 4.3. Step lists (`:::steps`) now have the same spacing as ordinary bullet lists.
- The editor copies the deck into `.mdeck-backups/` beside it before the first change of each session and keeps the ten newest copies.
- A slide's `title:` setting names it in the outline and reader navigation when it has no heading.
- Code blocks stay left-aligned in centred layouts such as `focus`.

## 1.1.0 — 2026-09-17

- One address parameter selects the view: `?view=deck`, `?view=share`, `?view=presenter`, `?view=audience`, with the short forms `?v=d`, `?v=s`, `?v=p`, `?v=a`. The former `?presenter=1`, `?audience=1` and `?share=1` are gone; launchers, the presenter command and the editor use the new form.
- The reader's Look menu always offers "Reset to default", and every reader button has an icon and the same style.

## 1.0.2 — 2026-09-17

- The reader view no longer shows speaker notes just because the file contains them. Notes appear in Read mode only when the deck sets `share.notes: true`, so one build can serve both the presenter and the people you send the link to.

## 1.0.1 — 2026-09-16

- The slide-writing skill follows the Agent Skills format and works with any assistant; `mdeck skill` installs it for Claude Code, Codex, Cursor, GitHub Copilot and Gemini CLI, or prints it for other tools.
- The skill finds the reference docs in the installed package, asks `mdeck templates` and `mdeck extensions` for the deck's real layouts and looks, and checks its result with `mdeck check`.
- README with rendered example slides and a theme GIF; corrected theme descriptions in the authoring reference; package homepage points at the docs site.

## 1.0.0 — 2026-09-16

The first release. Everything below is included.

- Slides written in Markdown with YAML settings, named content areas and speaker notes.
- Seven built-in layouts, six themes and eight colour palettes; deck-local templates, themes and palettes described by one `extension.toml` format.
- Presenter view with notes, timer and a synchronised audience window.
- Reader view for shared decks: outline, Read mode for phones, look picker, deep links, PDF download; `mdeck build --share` strips speaker notes and renders the PDF with a local Chrome.
- `mdeck pdf` renders a PDF on its own, one page per slide with real text.
- Builds as a folder or as one self-contained HTML file, with optional presenter launchers.
- Browser editor (`mdeck edit`, experimental): outline, live preview, form-based slide and deck settings, autosave with undo, and editors for palettes, themes and templates.
- Validation (`mdeck check`), listings (`mdeck templates`, `mdeck extensions`), a scaffolding wizard (`mdeck new`) and offline documentation (`mdeck docs`).
- A slide-writing skill for Claude Code.
