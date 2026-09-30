# Draw on your slides

You can draw on a slide while you present, or ahead of time: circle a number, underline a line of code, sketch an arrow. It works with a mouse, a finger, and best with an iPad and its pencil. What you draw is kept with the presentation and shows again the next time you present it, in the reader view and in PDFs.

## Start drawing

Press **D** in the full-screen deck or in the presenter view, or use the pencil button (**✎ Draw**). A toolbar appears on the slide:

| Tool | What it does |
|---|---|
| Pen | Thin to thick with the pencil's pressure. Kept. |
| Highlighter | A wide, see-through stroke over text. Kept. |
| Marker | Fades after a few seconds, for pointing at something. Never kept. |
| Eraser | Removes whole strokes you touch. |

The toolbar also has colours, three sizes, undo and redo (also Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z), **Clear this slide**, previous and next slide, and **Done**. Press **D** or **Escape** to stop drawing. While you draw, clicks and taps draw instead of changing slides.

**I** hides and shows what was drawn before, for example when a slide should look clean again. The toolbar has the same switch.

The audience window, and any other deck window in the same browser, shows every stroke as you draw it.

## Where drawings are kept

Drawings live in a file next to your slides: `my-talk.ink.json` for `my-talk.md`. Keep the two together, and send or check in both.

- **With `mdeck dev` or `mdeck present`**, each stroke is saved in that file as soon as you lift the pen. Nothing reloads, and the talk goes on.
- A slide that gets its first drawing receives an `id:` in its settings, made from its heading, for example `id: the-important-part`. The drawing stays with that slide when you add or move slides. If you change the `id:` in the editor, the drawing moves with it.
- If you delete a slide that has drawings, they stay in the file. `mdeck check` tells you about them; bring the slide back, or delete them from the file.
- The first save of a session keeps a copy of the previous file in `.mdeck-backups`, next to your slides.
- **Opened from a built folder or a single file**, the page has nowhere to save. Drawings are kept in that browser, and the toolbar's download button saves them as the ink file, to put next to your slides. Safari may clear such browser data after a week without use, so download it after drawing.

Builds and PDFs include the drawings. To leave them out, add `--no-ink`:

```sh
mdeck pdf my-talk.md --no-ink
```

## Present from an iPad

There are two ways.

**The iPad on its own.** Connect it to the projector, which usually shows the same picture as the iPad, and open the full-screen deck. Tap the left or right edge to go back or forward, or use the toolbar's arrows while drawing. Use the deck, not the presenter view, so your notes are not on the wall.

**The iPad next to your laptop.** The laptop shows the slides on the projector; you draw and go through the slides on the iPad, with your notes on it.

1. Start `mdeck dev my-talk.md --host`, so the iPad in the same network can reach your laptop.
2. On the launch page, under **Present from an iPad**, choose **Show pairing code** and scan it with the iPad's camera. The presenter view opens on the iPad, paired with your laptop, so it may save drawings and steer the phones of a poll.
3. On the laptop, open the **audience window** from the same place and move it to the projector. It follows the iPad: slides, revealed points, and drawings as you draw them.

A pairing code works once, for ten minutes. **Unpair** on the launch page ends every pairing; so does stopping `mdeck dev`. Scan a new code afterwards.

On a touch screen the presenter view shows only the slide, with a small bar at the top: timer, previous and next, draw, **Notes** (a drawer with your notes and the next slide, also **N**), full screen, and a button back to the layout with notes beside the slide. Your choice is remembered on that device.

With a room server of your own (`live.server`, see [Ask your audience](audience.html)), the same works with a hosted deck: open the presenter view on the iPad with your presenter code (`?livekey=…`), and the audience window anywhere else follows it. Drawings are then kept on the iPad; download the ink file after the talk.

## Tips for the iPad

- **Full screen**: the ⛶ button or **F**, where the browser allows it. Safari on an iPhone does not. Alternatively, use Share → **Add to Home Screen**: the deck then opens without Safari's bars. Such a Home Screen app keeps its own browser data, apart from Safari's.
- **Fingers and the pencil**: until you use the pencil, a finger draws too. After that, only the pencil draws, so a resting hand leaves no marks. The hand button on the toolbar lets fingers draw again.
- **Networks**: many large Wi-Fi networks do not let devices reach each other. If the iPad cannot open the pairing code, connect both to a phone hotspot.
