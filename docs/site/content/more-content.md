# Tables, tips, and more

Once you are comfortable with headings and lists, you can add a few other kinds of content. Use these when they make an idea easier to understand.

## Make a table

A table compares things side by side. Vertical lines separate the columns:

```markdown
| Activity | Bring |
|---|---|
| Planting | Gloves |
| Planning | A notebook |
| Lunch | Something to share |
```

Keep tables small enough to read from the back of the room.

## Add a tip or reminder

A callout is a short note with a visible label. Choose `note`, `tip`, `important`, `warning`, or `caution`:

```markdown
:::tip
Bring a spare copy of your presentation.
:::
```

Add your own label after the type if you prefer:

```markdown
:::note Before we begin
Please put your phone on silent.
:::
```

With `lang: de` in the settings for the whole presentation, tips and reminders get German labels, as do the buttons people see when you share the slides. You can also customize individual labels:

```yaml
lang: de
callouts:
  tip: "Gut zu wissen"
```

## Put ordinary content in columns

For two or more equal-width columns within a slide, use a columns block. The `+++` line starts the next column:

```markdown
# What to bring

:::columns
## For the garden
- Gloves
- Water
+++
## For the meeting
- Notebook
- Questions
:::
```

You can put a tip inside a column. Give each opening block its own closing `:::` line. For unequal widths, use the [split layout](layouts.html#two-areas-side-by-side).

## Cite a source

A footnote puts a short reference near the bottom of the slide:

```markdown
This finding comes from our neighborhood survey.[^survey]

[^survey]: Garden team survey, May 2026.
```

The name inside the brackets connects the sentence to its source. Give each source a different name.

## Add a QR code

A QR code lets people open a link on their phones. Replace the address below with your own:

```html
<qrcode url="https://example.com" size="240" />
```

`size` sets its width in slide pixels. The code takes the slide's text colour on the slide's background, so it fits every theme. If a scanner struggles, give it a white background with `--qr-bg: #fff` and `--qr-ink: #000` in a theme or a `style` around it. Keep enough space around it, and test it on the screen you will use.

To ask the audience a question instead, a poll shows its own QR code and the answers as they come in, and `<join />` shows the code for all your questions at once. See [Ask your audience](audience.html).

## Show a formula

Formulas use a notation called LaTeX. For a formula in a sentence, put it between dollar signs:

```markdown
The area is $A = \pi r^2$.
```

For a formula on its own line, use two dollar signs above and below it:

```markdown
$$
A = \pi r^2
$$
```

## Show a code example

If your talk includes programming, put the example between lines of three backticks. The language name helps mdeck color the code:

````markdown
```python
print("Hello, everyone!")
```
````

You can add `copy` to show a copy button. For JavaScript and Python, `live` adds a Run button and `editable` lets you change the example while presenting:

````markdown
```python live editable copy
print(2 + 2)
```
````

Live Python downloads its runtime the first time it runs, so it needs an internet connection. Live JavaScript runs in the presentation page itself, not in an isolated sandbox. Only run code you trust; a long-running example can make the presentation unresponsive.
