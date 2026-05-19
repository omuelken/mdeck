# Claude Code skill — /write-slides

The `skills/write-slides/` directory contains a [Claude Code](https://claude.ai/code) skill that drafts a complete mdeck slide deck on request. It reads the framework docs automatically before writing anything.

## Installation

Claude Code looks for skills in two places:

| Location | Path | Available in |
|---|---|---|
| Personal | `~/.claude/skills/<name>/` | Every project |
| Project | `.claude/skills/<name>/` | This project only |

Copy the skill directory to whichever location suits you:

```bash
# Personal — available in every project
cp -r skills/write-slides ~/.claude/skills/write-slides

# Project-local — only available inside this repo
mkdir -p .claude/skills
cp -r skills/write-slides .claude/skills/write-slides
```

> The skill reads docs via relative paths (`docs/authoring.md` etc.), so it works best when Claude Code is opened at the mdeck repo root.

## Usage

```
/write-slides A 20-minute talk on design systems for a frontend engineering audience
/write-slides Intro lecture on machine learning for first-year students, 10 slides
```

Claude reads the framework docs and `examples/demo.md`, then writes a complete `.md` deck and saves it to a file.
