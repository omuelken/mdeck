# Write slides with an AI assistant

mdeck ships a skill, `write-slides`, that lets an AI coding assistant draft a
complete deck from a short brief. It reads the mdeck reference docs, asks the
installed `mdeck` command which layouts, themes and palettes the deck can use
(including designs kept in the deck's `extensions/` folder), writes the file,
and runs `mdeck check` on the result.

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

## Use it

| Assistant | How to start |
|---|---|
| Claude Code | `/write-slides A 20-minute talk on design systems for frontend engineers` |
| Codex | Ask for slides; the skill is picked up by its description |
| Cursor | Mention `@write-slides` or ask for an mdeck deck |
| GitHub Copilot | Run the `write-slides` prompt from the prompt picker |
| Gemini CLI | `/write-slides A 20-minute talk on design systems` |
| Anything else | Paste the output of `mdeck skill --print` followed by your request |

The assistant writes a `.md` file named after the topic, checks it, and tells
you the commands to preview, present and share it. Review the notes and the
pictures it asks for, then:

```sh
mdeck dev <deck>.md
mdeck build <deck>.md --share --self-contained -o <deck>.html
```

## What the skill knows

It carries a short quick reference of the file format so it can work even
without the docs, finds the full reference docs in the repository or the
installed package, and prefers the live answers from `mdeck templates --json`
and `mdeck extensions` over its own memory.
