# Write your slides

Markdown is a way to add simple formatting to plain text. You write a few marks alongside your words, and mdeck turns them into headings, lists, and slides.

## Headings and paragraphs

Put `#` and a space before the main heading. Use `##` and a space for a smaller heading. Leave a blank line between paragraphs.

```markdown
# Our next adventure

This is a paragraph of ordinary text.

## Where we are going

This paragraph explains a little more.
```

Keep each slide focused on one idea. If your words do not fit, make another slide rather than making all the text smaller.

## Start another slide

Write three dashes on a line of their own:

```markdown
# The first idea

Some words about it.

---

# The next idea

Some more words.
```

## Lists, emphasis, and links

| You write | What it means |
|---|---|
| `- A point to remember` | A bullet point |
| `1. First step` | A numbered list item |
| `**important words**` | Bold words |
| `*a little emphasis*` | Emphasized words, styled by your theme |
| `[Visit our website](https://example.com)` | A clickable link |

Put each list item on its own line:

```markdown
- Bring a notebook.
- Ask **one good question**.
- Share what you learn.
```

## Give a slide some settings

You can tell mdeck which layout to use. Put this small settings block at the beginning of a slide:

```markdown
:::meta
layout: focus
:::
# One idea worth remembering.
```

The opening `:::meta` and closing `:::` mark the settings. The line between them asks for the `focus` layout: a large statement slide. The words beneath the block are the slide's content.

You do not need a settings block on every slide. The [layout guide](layouts.html) gives you complete examples to copy.

## Give a slide a lasting link

Add an `id` when you want to link directly to a particular slide:

```markdown
:::meta
id: questions
:::
# Your questions
```

You can then add `#questions` to the presentation's address. IDs must be unique within the talk and start with a letter. Use letters, numbers, hyphens, or underscores, with no spaces.

## Settings for the whole presentation

A settings block at the very top of the file controls the whole presentation. It uses `---` around its contents:

```markdown
---
theme: neue
palette: swiss
meta:
  title: "Our next adventure"
  author: "Alex Morgan"
---

---
:::meta
layout: title
:::
# Our next adventure
## A plan we can share
```

Keep the spaces before `title` and `author`: they put those values inside the `meta` group. Use spaces rather than tabs. Quoting text is helpful when it contains punctuation.

For a talk in German, add `lang: de` to these settings. The page is then marked as German, which helps screen readers and hyphenation, and the words mdeck adds for your audience, such as the buttons for readers and polls, are German too.

## Reading older examples

Older decks put slide settings between `---` lines too:

```markdown
---
layout: focus
---
# One idea worth remembering.
```

This still works. For new slides, the explicit `:::meta` form makes it easier to see where settings end and writing begins.
