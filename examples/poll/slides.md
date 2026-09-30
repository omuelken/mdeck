---
design: neue
palette: sage
meta:
  title: "Ask the room"
  author: "Tilman Schieber"
  organization: "FHNW"
  date: "2026-09-30"
---

---
layout: title
---
# Ask the room.
## A live poll in a plain slide file.

:::notes
Start this deck with `mdeck dev slides.md --host` so phones in the same network can vote.

This deck shows the whole idea in two polls: one question on the slide, one answered on the phone.
:::

---
# People answer on their phones, the slide counts.

:::steps
- **Scan** — one QR code for the whole talk.
- **Tap** — the phone shows one button per answer.
- **Watch** — the bars grow as the answers come in.
:::

:::notes
Reveal the three steps, then move on to try it right away.

Stress that nobody installs anything: the QR code opens the same slides, showing only the buttons. People scan once; their phones follow along to each poll.
:::

---
title: "Poll: how do you make slides?"
---
# How do you make slides today?

<poll room="tools" options="PowerPoint|Keynote|Google Slides|LaTeX Beamer|Markdown" />

:::notes
Give people half a minute to scan and vote. Read out the leader once the bars settle.

Anyone can change their answer: only the latest vote from each phone counts.

Before the talk, hover over the results and click Reset to clear test votes.
:::

---
# Writing a poll takes one line.

```markdown
<poll room="tools"
      options="PowerPoint|Keynote|Google Slides|LaTeX Beamer|Markdown" />
```

- **room** — a short name, different for every poll in the deck.
- **options** — the answers, separated by `|`.
- **question** — optional; without it, phones show the slide heading.

:::notes
Point at the line that made the previous slide. That line is all the author writes.

The next slide uses `question`, so the text on the phone differs from the slide heading.
:::

---
title: "Poll: next feature"
---
# One more before we finish.

<poll room="next" question="Which feature should mdeck get next?" options="Word clouds|Open questions|Quizzes|Timers" />

:::notes
This poll sets its own `question`, which appears above the bars and on the phones.

Mention that each of these is an ordinary Preact component on top of the same rooms, and that the "Create interactive content" guide shows how to write one.
:::

---
# Try it on your own computer.

```sh
mdeck dev slides.md --host
```

- **Same network** — phones must be able to reach your computer.
- **Lecture hall** — run `mdeck live` on a web server; the slides stay on your laptop.

:::notes
For a lecture hall, run `mdeck live` on a web server once and point `live.server` at it. The phones only talk to that room server; the slides never leave this laptop. The "Ask your audience" guide has the details.

Many university networks keep devices apart. If phones cannot open the page, use a phone hotspot or a room server on the internet.
:::
