# Work with an AI assistant

The usual way to make an mdeck presentation is to give an AI assistant the
material you already have (old slides, a PDF, a Word document, a paper, a page
of notes) and let it turn that into a deck. The content stays yours; the
assistant shapes it into slides, chooses layouts, writes speaker notes from
your text, and checks its work with mdeck.

mdeck ships a skill, `write-slides`, for this. It reads the mdeck reference
docs, asks the installed `mdeck` command which layouts, themes and palettes the
deck can use (including designs kept in the deck's `extensions/` folder),
writes the file, and runs `mdeck check` on the result.

The skill is written in the [Agent Skills](https://agentskills.io) format, a
`SKILL.md` file that Claude Code, OpenAI Codex and other assistants read
directly. For tools with their own conventions, `mdeck skill` writes the same
instructions in their format.

## Install it

```sh
mdeck skill                        # list the supported assistants
mdeck skill --install claude       # Claude Code, personal (~/.claude/skills/)
mdeck skill --install codex        # OpenAI Codex, personal (~/.codex/skills/)
mdeck skill --install cursor       # Cursor rule in this project (.cursor/rules/)
mdeck skill --install copilot      # GitHub Copilot prompt file (.github/prompts/)
mdeck skill --install gemini       # Gemini CLI command (.gemini/commands/)
mdeck skill --install claude codex --project   # into this project instead of your home folder
mdeck skill --print                # the skill as text, for any other tool
```

Run the command in the folder of the deck you are working on when installing
project-level files. Re-run it after updating mdeck to pick up changes.

## Start a deck

Copy your material into the talk's folder, open the assistant there, and say
what to make from it: for whom, how long, in which language, and how closely
to keep to the original.

```prompt
/write-slides Rebuild kinetics-2023.pptx as a 45-minute lecture for
second-year biology students, in German, academic theme. Keep the order
and the figures, split the crowded slides, and add what is new in
notes/2026-changes.md.
```

| Assistant | How to start |
|---|---|
| Claude Code, Gemini CLI | `/write-slides` followed by your request |
| Codex | Ask for slides; the skill is picked up by its description |
| Cursor | Mention `@write-slides` or ask for an mdeck deck |
| GitHub Copilot | Run the `write-slides` prompt from the prompt picker |
| Anything else | Paste the output of `mdeck skill --print` followed by your request |

The assistant writes a `.md` file named after the topic, checks it, and tells
you what it left out or added. Open the preview and leave it running while you
work; it reloads every time the file changes:

```sh
mdeck run <deck>.md
```

## Change it by asking

Keep talking to the assistant and watch the slides follow:

```prompt
You dropped the comparison table from page 12 of the PDF. Put it back
after the methods slide, and turn "Why it matters" into a big statement.
```

The assistant can also make what would otherwise need CSS or JavaScript: a
colour palette, a theme, a slide layout, or an interactive component. They are
kept as small folders in `extensions/` or `components/` beside the slide file,
so they travel with the talk. For a theme or palette, it asks you to look at
the result with `mdeck design <deck>.md`, which shows it on a sample deck with
every kind of slide, light and dark, and lets you fine-tune colours, fonts and
sizes yourself.

For a word or a number, it is often faster to edit the file yourself; see
[Read and adjust your slides](writing.html).

## Check what it wrote

`mdeck check` finds missing pictures and settings mistakes. It does not know
whether the talk is right, or whether the text fits on each slide. Before
presenting, compare the deck with your material, look at every slide in the
preview, and try any polls with a phone.

## What the skill knows

It carries a short quick reference of the file format so it can work even
without the docs, finds the full reference docs in the repository or the
installed package, and prefers the live answers from `mdeck list layouts --json`
and `mdeck list` over its own memory.
