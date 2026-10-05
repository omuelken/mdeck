# Add notes and present

The presenter view puts your current slide, the next slide, your notes, and a timer in one place. Your audience can see the slides in a separate window.

## Write notes for yourself

Add a notes block at the end of a slide:

```markdown
# A place to grow

Every neighborhood has a starting point.

:::notes
Welcome everyone. Ask who has visited the garden.

- Pause for answers.
- Keep this introduction short.
:::
```

The words between `:::notes` and `:::` appear in the presenter view, not on the audience slide.

Older files may use `note:` or `notes:` inside slide settings. Those still work. The block above is often easier to read and edit.

## Open the presenter view

```sh
mdeck run my-talk.md
```

The launch page it opens has a **Presenter view** button.

Use its audience-window button to open a separate view of the slides. If you have a projector or second screen, move that audience window onto it. Keep the presenter window on your own screen.

The two windows follow the same slide and reveal position. This works between windows in the same browser on your computer. To present from an iPad while your laptop shows the slides, see [Draw on your slides](drawing.html#present-from-an-ipad).

To let people answer a question on their phones, put a poll on a slide. See [Ask your audience](audience.html).

## Move through the talk

| Key | What it does |
|---|---|
| Right arrow, Space, or Page Down | Show the next point, then the next slide |
| Left arrow or Page Up | Hide the last revealed point, or return to the previous slide |
| Home | Go to the first slide |
| End | Go to the last slide when the slide view has focus |
| R | Start again and clear the reveals |
| D | Start or stop drawing on the slide ([Draw on your slides](drawing.html)) |
| I | Hide or show the drawings |
| F | Full screen, where the browser allows it |
| N | Open or close the notes drawer, in the presenter view's slide-only layout |

Click the slide area if your keys are not controlling it. Keys behave normally while you are typing in a text field.

The timer is for your own reference; you can start, pause, and reset it in the presenter view.

## Reveal points one at a time

Wrap a list in a steps block:

```markdown
# Our plan

:::steps
- Meet the neighbors.
- Choose a first project.
- Set a date.
:::
```

Each press of the next key reveals one point. Once all points are visible, the next press moves to the following slide. Printed slides show all the points.

## Before the talk

- Open the talk on the computer you will use.
- Try the audience window and check the correct screen is showing.
- Test every video, especially if it comes from the internet.
- Run `mdeck check my-talk.md` to look for missing files or settings mistakes.
- If the talk has a poll, scan its QR code with a phone in the room's network and vote once. Then reset the poll.

## Are my notes private?

Notes are hidden from the audience view, but a normal build includes them in the file, and someone with that file can inspect them. For a version to send around, build with `mdeck build my-talk.md --share`, which removes the notes (see [Share or print your slides](sharing.html)).
