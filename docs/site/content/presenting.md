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

The `write-slides` skill writes notes for every content slide. Make them yours before you present, by hand or by asking:

```prompt
Shorten the notes to cues I can glance at, and mark which slides I
can skip if I run out of time.
```

## Open the presenter view

```sh
mdeck run my-talk.md
```

The launch page it opens has a **Presenter view** button. The presenter view shows the slide with a toolbar under it, and beside it the time, the next slide and your notes:

- **Under the slide**: previous and next, then drawing, black screen, freeze, all slides, hotspots and full screen, and **This slide**: what can be done on the slide shown, such as a poll's lock, results and right answer, or playing its video. Point at a button to see what it does and its key; **?** lists all keys.
- **At the top of the notes**: the slide number (type one to jump there), the timer, the audience window button (a projector), the icons of who is connected, and the settings.
- **Who is connected** (the icons): the audience windows, a paired iPad, phones; the join link for polls; and the codes that pair an iPad or a phone. A red dot means something needs you, such as phones that do not follow.
- **Settings**: the layout (speaker, slide only, phone clicker), the theme, palette and light or dark to try, the language, the timer and rehearsal, the size of the notes, and the way back to the launch page.

Open the audience window with the projector button. If you have a projector or second screen, move it there, and keep the presenter view on your own screen.

The two windows follow the same slide and reveal position: navigate in either window and the other follows. This works between windows in the same browser and between your laptop and a paired iPad. To connect the iPad, see [Draw on your slides](drawing.html#present-from-an-ipad).

A video file you play, pause or move in the presenter view does the same in the audience window, which plays the sound; the presenter view's copy stays silent while the audience window is open. Click the audience window once before the talk, so the browser lets it play sound.

For a single screen, choose **Slide only** in the settings. **F** or the fullscreen button fills the screen in either the presenter view or the audience window; fullscreen does not select another view.

To let people answer a question on their phones, put a poll on a slide. See [Ask your audience](audience.html).

## Move through the talk

| Key | What it does |
|---|---|
| Right arrow, Space, or Page Down | Show the next point, then the next slide |
| Left arrow or Page Up | Hide the last revealed point, or return to the previous slide |
| Home | Go to the first slide |
| End | Go to the last slide when the slide view has focus |
| R | Start again and clear the reveals |
| B or . | Make the audience's screen black, and show the slide again (see below) |
| J | Show the join code over the slide, on every screen, and hide it again, in the presenter view of a deck with polls ([Ask your audience](audience.html)) |
| O | Show all slides in a grid, to pick one (see below) |
| D | Start or stop drawing on the slide ([Draw on your slides](drawing.html)) |
| I | Hide or show the drawings |
| F | Full screen, where the browser allows it |
| N | Open or close the notes drawer, in the presenter view's slide-only layout |
| L | Switch to the talk's next language, for a talk written in several (see below) |
| 1–9 | Zoom in on a part of the slide, with hotspots on (see below); without them, nothing |
| 0 or Escape | Show the whole slide again |
| H | Turn hotspots on or off for this talk, in the presenter view |
| T | Start or pause the timer, in the presenter view |
| ? | Show the keys that work at this moment, over the slide; **?** again or Escape closes the list |

## Use your phone as a clicker

Start `mdeck run my-talk.md --network`, open the presenter view, click the connection icons at its top, choose **Phone clicker**, and scan the code with the phone's camera. The phone shows the slide small, the time and how you stand against the plan, your notes in large print, and big **Previous** and **Next** buttons where your thumb is. Under the slide it has the slide's own controls: close a poll, show its results or the right answer, play a video, zoom into a numbered part. The audience window on the laptop does what the phone does. Nothing on the phone draws. Where the browser allows it (`https://`, or a page on the laptop itself), the phone's screen stays on during the talk.

The clicker is one of the presenter view's layouts: the settings switch any presenter view between **Speaker**, **Slide only** and **Clicker**, on the phone as well. Each device remembers its layout.

## Black out the screen

Press **B** when the room should look at you, not at the slide: the audience window goes black, and so do a paired iPad's audience window and phones following the talk. Your presenter view keeps the slide under a dark veil and says that the audience sees a black screen. **B** again, the next key (→, Space) or a click on the black screen shows the slide again, without moving on. Many presentation clickers have a button for this; it sends a full stop, which works like **B**. The presenter view also has a button for it.

Press **P** to freeze the slide the audience sees, for example to look something up on another slide or to prepare the next one: the audience window keeps its slide, and so do phones following the talk and the phones of a poll, while you go on in the presenter view or on a paired iPad. The presenter view says which slide the audience still sees. While it is frozen, the audience window does not page on its own. **P** again, or the snowflake button, lets the audience follow again: it goes to the slide you are on.

## Find a slide

Press **O**, or the button with the row of slides, to see every slide of the talk in a grid: the slide shown has a red frame. Move with the arrow keys and press Enter, or click a slide, to go there. **O** or Escape closes the grid and leaves you where you were. In the presenter view the grid opens in your own slide, so the audience keeps the slide they are looking at until you pick another. Every slide in the grid shows all of its points, to make it easier to recognise.

To jump to a slide, tap or click the slide number in the presenter view (beside the arrows on an iPad, at the top of the speaker layout), type the number and press Enter, or Go on an iPad's keyboard. Escape keeps the current slide.

Click the slide area if your keys are not controlling it. Keys behave normally while you are typing in a text field.

The timer is for your own reference; you can start, pause (**T**), and reset it in the presenter view. It keeps running through a reload of the page.

## Time your talk

Give a slide the time you want to spend on it with `time:` in its settings, and the whole talk a length with `time:` in the deck's settings:

```markdown
---
time: 20m
---

---
:::meta
time: 2m
:::
# The results
```

Write times as `90s`, `2m`, `1m30s` or `1.5m`. Slides without a time share what the deck's time leaves over; without a deck time, they get none.

Once the deck has times, the presenter view shows under the timer how much time is left on the slide (amber in its last 15 seconds, red once it is over), the length of the talk, and whether you are ahead of or behind your plan. In the slide-only layout the time left on the slide sits beside the timer.

### Rehearse

You do not have to guess the times. Rehearse the talk and mdeck measures them:

```bash
mdeck rehearse my-talk.md
```

This opens the presenter view rehearsing: the timer starts, and every second on a slide counts towards it, including when you come back to it. **Rehearse** in the presenter view's settings, and the tile on the launch page, start a rehearsal too. Press **Finish**, or go on past the last slide, and a table shows for each slide the time it has, the time you spent and the new time, rounded to 15 seconds. Change a new time in 15-second steps with **−** and **+** (or **↑** and **↓** on its row), put back the time the slide had, or take the slide's time out. **Save to deck** writes the new times into the slides' settings, so you can see them in the file and change them like any other setting. The open windows do not reload, and the deck is copied to `.mdeck-backups/` first.

Saving needs `mdeck run` or `mdeck rehearse`. A deck you built can still rehearse; **Copy** gives you the times to paste in yourself.

## Zoom in on part of a slide

Hotspots let you show one part of a slide large: a picture, a chart, a code block, a table. Turn them on in the deck's settings:

```markdown
---
hotspots: auto
---
```

The presenter view then puts a small numbered key on each part of the slide you can zoom to. Press its number, or tap the key on an iPad, and the slide zooms smoothly until that part fills the screen. A part of another shape than the screen keeps the slide around it in view. The audience window, a paired iPad and phones following the talk zoom along; only the presenter view shows the keys.

To see the whole slide again, press the same number again, **0** or **Escape**, tap the slide, or use **1:1**. The next point or the next slide shows the whole slide by itself, so you never need an extra key press to move on. Another number while zoomed goes straight to that part.

| Setting | What gets a key |
|---|---|
| `hotspots: auto` | Pictures, code blocks, tables, formulas, videos, callouts, columns and polls, and anything marked `data-hotspot` |
| `hotspots: marked` | Only what you marked with `data-hotspot`; nothing is found by itself |
| `hotspots: off` | Nothing. This is the default: the number keys do nothing |

A slide can have its own setting in its frontmatter, such as `hotspots: false` for a slide whose numbers you do not want, or `hotspots: auto` on one slide of a deck without hotspots. Mark a part of your own in inline HTML with `data-hotspot`, and keep a found one out with `data-hotspot="off"`:

```markdown
The rate is <span data-hotspot>**2.4 %** a year</span>, for now.
```

In a drawing that takes its colours from the theme, `data-hotspot` on a group makes that part of the drawing a hotspot.

Parts that nearly fill the slide, or its whole width, get no key, since there is nothing to zoom; what is inside them may. A part inside another one shares its key: a column with a formula and a tip in it is one part. The keys follow reading order, up to nine on a slide. In the editor, the deck's settings and each slide's details have a **Hotspots** choice too. **H**, or the button beside **Draw**, turns hotspots on or off for the rest of the talk without changing the deck; a slide set to `false` stays without them.

## One talk in several languages

To give a talk in English, German or another language as the room needs, write it once per language, in files side by side named for it:

```text
talk.en.md
talk.de.md
```

Start either with `mdeck run talk.en.md`: the presenter view gets a **Language** switch, and **L** goes to the next language. Switching changes the slides, your notes and the words mdeck shows in every window, including the audience window, a paired iPad and phones following along, and keeps your place, the step on the slide and the drawings. Slides match by their place in the deck, so keep the same slides in the same order in every file. A talk in one language shows no switch.

`mdeck send talk.de.md` makes the German file to hand out; each file is a complete deck of its own.

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

Each press of the next key reveals one point. Once all points are visible, the next press moves to the following slide. Printed slides show all the points. A drawing can build up the same way; see [A drawing that builds up](media.html#a-drawing-that-builds-up).

## Before the talk

- Open the talk on the computer you will use.
- Try the audience window and check the correct screen is showing.
- Test every video, especially if it comes from the internet.
- Run `mdeck check my-talk.md` to look for missing files or settings mistakes.
- If the talk has a poll, scan its QR code with a phone in the room's network and vote once. Then reset the poll.

## Are my notes private?

Notes are hidden from the audience view, but a normal build includes them in the file, and someone with that file can inspect them. For a version to send around, use `mdeck send my-talk.md`, which removes the notes (see [Send, host or print your slides](sharing.html)).
