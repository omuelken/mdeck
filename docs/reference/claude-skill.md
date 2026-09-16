# Write slides with Claude Code

mdeck ships a [Claude Code](https://claude.ai/code) skill, `/write-slides`, that
drafts a complete deck from a short brief. It reads the mdeck reference docs,
asks the installed `mdeck` command which layouts, themes and palettes the deck
can use (including designs kept in the deck's `extensions/` folder), writes the
file, and runs `mdeck check` on the result.

## Install the skill

The skill is one folder, `skills/write-slides/`, inside the mdeck package.
Copy it to where Claude Code looks for skills:

| Location | Path | Available in |
|---|---|---|
| Personal | `~/.claude/skills/write-slides/` | Every project |
| Project | `.claude/skills/write-slides/` | That project only |

From an installed mdeck:

```sh
cp -r "$(npm root -g)/@tilman.schieber/mdeck/skills/write-slides" ~/.claude/skills/
```

From a checkout of the repository:

```sh
cp -r skills/write-slides ~/.claude/skills/
```

The skill finds the reference docs either in the current folder (inside the
repository) or in the globally installed package, so it works from any deck
folder once `mdeck` is installed.

## Use it

```
/write-slides A 20-minute talk on design systems for a frontend engineering audience
/write-slides Intro lecture on enzyme kinetics for first-year students, 10 slides, German
```

Claude writes a `.md` file named after the topic, checks it, and tells you the
commands to preview, present and share it. Review the notes and pictures it
asks for, then:

```sh
mdeck dev <deck>.md
mdeck build <deck>.md --share --self-contained -o <deck>.html
```

## What the skill knows

It carries a short quick reference of the file format so it can work even
without the docs, and it prefers the live answers from `mdeck templates --json`
and `mdeck extensions` over its own memory. Update the copy in your skills
folder when you update mdeck.
