# Edit slides in your browser

> The editor is new and marked **experimental**. It only ever rewrites the parts of your file you change, every change can be undone, and before its first change mdeck keeps a copy of the file (see below).

Your assistant and any text editor write the same slide file. If you prefer clicking and typing in forms, mdeck also has a visual editor:

```sh
mdeck edit my-talk.md
```

This opens a page on your own computer with three parts:

- **Slides**, on the left: the list of slides. Select one, add a new one from a list of layouts, duplicate it, remove it, or move it up and down.
- **Preview**, in the middle: your presentation, always showing the selected slide. Use the buttons underneath to step through points and slides.
- **Details**, on the right: what the selected slide contains. Every layout has one or more text areas for its content, and some have settings such as a picture or the width of two columns. Speaker notes and the slide's name are here too. The **Markdown** tab shows the same slide as plain text, if you prefer that.

The **Deck** tab in the right panel changes the whole presentation: the theme, the colors, your name and title, and the slide shape.

## Changes are saved as you go

There is no save button. Every change is written into your slide file within a moment; the status next to the file name says *Saved* when it is done. Undo and redo (⌘Z and ⇧⌘Z, or Ctrl on Windows and Linux) work across everything you change, and the file follows along.

Because the file is the only copy, you can keep your text editor or your AI assistant working at the same time. When either changes the file, the visual editor shows the change. If both change the same file at the same moment, the editor asks which version to keep.

The editor only ever rewrites the parts of the file you change. Your blank lines, comments and the order of everything else stay as they are.

Before the first change of each editing session, mdeck copies the file as it was into a `.mdeck-backups` folder beside it, named after the deck and the time, for example `.mdeck-backups/my-talk-2026-09-29T10-15-00Z.md`. It keeps the ten newest copies of each deck. If you keep your slides in Git, add `.mdeck-backups/` to your `.gitignore`.

## Palettes, themes and layouts

The second tab at the top, **Palettes, themes & layouts**, lets you make your own looks and slide layouts. They are saved in an `extensions` folder next to your slide file, so they travel with the talk.

- A **palette** is a set of colors. Pick a color for each role and see the preview repaint at once.
- A **theme** is a whole look: fonts, sizes, spacing and the rules that arrange each slide. The color and size values are a form; the arrangement rules are CSS in a text area.
- A **layout** is a slide arrangement: which content areas it has, which settings it accepts, and how it is drawn. The areas and settings are a form; the drawing code is a small Preact component in a text area.

The palettes, themes and layouts that come with mdeck cannot be changed in place. Choose one and press **Copy into this deck to edit** to start from it under a new name.

## Keyboard shortcuts

| Keys | What happens |
|---|---|
| ⌘Z, ⇧⌘Z | Undo, redo |
| ↑ ↓ | Select the previous or next slide (outside text fields) |
| ⌘↩ | Add a slide after the selected one |
| ⌘⌫ | Remove the selected slide |

## Good to know

- `mdeck edit` runs only on your computer. It is not a website other people can open.
- The editor checks your slides the same way `mdeck check` does and shows problems next to the slide they belong to.
- To present, use the **Present** button at the top right, or open the presenter view from the launch page of `mdeck run my-talk.md`.
