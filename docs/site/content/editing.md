# Edit slides in your browser

Your assistant and any text editor write the same slide file. If you prefer clicking and typing in forms, mdeck also has a visual editor:

```sh
mdeck edit my-talk.md
```

This opens a page on your own computer with three parts:

- **Slides**, on the left: the list of slides. Select one, add a new one from a list of layouts, duplicate it, remove it, or move it up and down.
- **Preview**, in the middle: your presentation, always showing the selected slide. Use the buttons underneath to step through points and slides.
- **Details**, on the right: what the selected slide contains. Every layout has one or more text areas for its content, and some have settings such as a picture or the width of two columns. Speaker notes and the slide's name are here too. The **Markdown** tab shows the same slide as plain text, if you prefer that.

The **Deck** tab in the right panel changes the whole presentation: the theme (chosen from pictures of your first slide in each one), the colors, light or dark, your name and title, and the slide shape.

It is not a drag-and-drop editor like PowerPoint or Keynote. You do not place boxes or resize text on the slide; you fill in each slide's content and settings, and the layout and theme decide where things go and how they look. That is what keeps every slide consistent, and what lets you change the whole look with one setting.

## Changes are saved as you go

There is no save button. Every change is written into your slide file within a moment; the status next to the file name says *Saved* when it is done. Undo and redo (⌘Z and ⇧⌘Z, or Ctrl on Windows and Linux) work across everything you change, and the file follows along.

Because the file is the only copy, you can keep your text editor or your AI assistant working at the same time. When either changes the file, the visual editor shows the change. If both change the same file at the same moment, the editor asks which version to keep.

The editor only ever rewrites the parts of the file you change. Your blank lines, comments and the order of everything else stay as they are.

Before the first change of each editing session, mdeck copies the file as it was into a `.mdeck-backups` folder beside it, named after the deck and the time, for example `.mdeck-backups/my-talk-2026-09-29T10-15-00Z.md`. It keeps the ten newest copies of each deck. If you keep your slides in Git, add `.mdeck-backups/` to your `.gitignore`.

## Look at and fine-tune themes and palettes

**Design themes**, at the top, opens the design page in a tab of its own. You can also start it on its own with `mdeck design my-talk.md`, or with `mdeck design` in a folder that has no deck yet. Themes and palettes are saved in an `extensions` folder next to your slide file (or in that folder), so they travel with the talk.

The usual way to get a new look is to describe it to your assistant; see [Create a theme or palette](theme-authoring.html). The design page is where you look at the result and adjust it:

- A **theme** is a whole look. The form has its fonts, sizes, spacing and the palettes it offers; the rules that arrange each slide are CSS under *Advanced*.
- A **palette** is a set of colors, light and dark. Pick a color for each role and see the preview repaint at once.

The preview shows a **sample deck** with one slide of every kind: title, chapter, lists and code, a table, callouts, lecture blocks, two columns, a statement, pictures. Step through it to see how a change looks everywhere. **My deck** shows your own slides instead. Above the preview you choose the palette a theme is shown with, the theme a palette is shown in, and light or dark; this only changes the preview.

On the left, your own themes and palettes come first. Below them are the ones that come with mdeck; these cannot be changed in place. Choose one and press **Copy to customise** to start from it under a new name. A new palette can also start from plain colours.

From the editor, **Customise theme** or **Customise palette** in the **Deck** tab opens the design page with a copy of the one your deck uses. **Use in my deck** puts a theme or palette in your slide file, and the editor shows it straight away.

Slide layouts are small programs; ask your assistant for one, or see [Make your own layouts](custom-layouts.html).

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
