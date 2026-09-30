# Changelog

## Unreleased

- Polls follow the presenter reliably: the launch page's presenter, audience and deck buttons carry the presenter code (taken out of the address bar at once), the presenter view says whether phones follow it and why not, and the current poll is repeated every few seconds so late phones and a restarted room server catch up.
- The launch page shows a small live preview of the deck and uses the same dark tool styling as the presenter view, the editor and the reader's bar; the presenter view's buttons and labels now match the editor's.
- The launch page is the dev server's plain address (the slides are at `?view=deck`) and links a presenter view and an audience window that belong together. For a deck with `live.server` it checks the room server and shows the viewers' link and the presenter code from `MDECK_LIVE_KEY`.
- One answer link per deck: every poll shows the same QR code, and phones follow the presenter to whichever poll is on screen, with a waiting note in between. Only the presenter's screen may announce the current poll. Polls keep a live connection only while their slide is shown, so decks with many polls stay within the browser's connection limit. Polls ignore `<poll>` examples inside code.
- `lang` is now the deck's language: built pages are marked with it, and the reader view, the deck's control bar, polls and the answer page use German or English words to match. The new `labels:` setting replaces single words. Presenter tools stay English.
- The launch page and the editor also answer on `*.localhost` names, as used by local development proxies.
- Audience interaction: `<poll room=… options=…>` shows live results and a QR code; phones that scan it get one button per option. Components can build their own activities with `useRoom` from `mdeck/live`. Rooms run inside `mdeck dev` (with `--host` for phones) or on a hosted room server started with `mdeck live`, set with the `live:` deck setting. Answers are anonymous and kept in memory only.
- Decks can share components: the `components:` setting lists extra folders, searched after the deck's own `components/` folder. The dev server allows and watches them, picks up changes to the list without a restart, and `mdeck check` reports folders that do not exist.
- `mdeck dev` opens a launch page for the deck: presenter, deck and reader views; the visual editor and the guides, started on first click; buttons that build the folder, the file to send and the PDF; and the `mdeck check` results. `--host` makes the slides reachable from phones in the same network; the launch page and its actions answer only on this computer. `mdeck dev` and `mdeck present` accept `--port` and `--no-open`.
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
