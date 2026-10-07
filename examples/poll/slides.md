---
theme: neue
meta:
  title: "Ask the room"
  author: "Tilman Schieber"
  organization: "FHNW"
  date: "2026-09-30"
---

---
:::meta
layout: title
:::
# Ask the room.
## Live questions in a plain slide file.

:::notes
Start this deck with `mdeck run slides.md --network` so phones in the same network can answer.

The deck shows every kind of question mdeck has: a poll, a scale, a word cloud and open answers. The QR code appears once, on the next slide.
:::

---
# Take out your phone.

<qrcode join />

:::notes
Leave this up until most people have scanned. The code is the same for the whole talk: phones that joined now follow along, and each question appears on them when its slide comes up.

Come back to this slide for latecomers, or leave the join code on the last question too.
:::

---
:::meta
title: "Poll: how do you make slides?"
:::
# How do you make slides today?

<poll room="tools" options="PowerPoint|Keynote|Google Slides|LaTeX Beamer|Markdown" qr="false" />

:::notes
A poll: one button per answer. Give people half a minute and read out the leader once the bars settle.

Anyone can change their answer: only the latest vote from each phone counts.

Before the talk, hover over the results and click Reset to clear test votes.
:::

---
:::meta
title: "Scale: Markdown"
:::
# How well do you know Markdown?

<scale room="markdown" min="1" max="5" low="Never used it" high="Every day" qr="false" />

:::notes
A scale: phones show the numbers from 1 to 5, the slide counts each one and shows the average.

A high average means the rest of the talk can go faster.
:::

---
:::meta
title: "Word cloud: slides"
:::
# One word for your last presentation?

<wordcloud room="mood" placeholder="One word" qr="false" />

:::notes
A word cloud: people may send as many words as they like. The more often a word comes in, the larger it gets, packed around the middle; capitals do not matter.

Pick out the largest word and one surprising small one.
:::

---
:::meta
title: "Open question"
:::
# What would you like to ask?

<question room="ask" placeholder="Your question" qr="false" />

:::notes
Open answers: the newest eight appear as cards, and people can send several.

Answer one or two now, and promise to go through the rest afterwards; the room keeps them until you reset it.
:::

---
# Each question is one line.

```markdown
<qrcode join />
<poll room="tools" options="PowerPoint|Keynote|Markdown" />
<scale room="markdown" min="1" max="5" low="Never" high="Daily" />
<wordcloud room="mood" />
<question room="ask" placeholder="Your question" />
```

- **room** — a short name, different for every question in the deck.
- **qr="false"** — leave out the code when `<qrcode join />` showed it earlier.
- **question** — optional; without it, phones show the slide heading.

:::notes
Point at the lines that made the previous slides. That is all the author writes.

The QR code takes the slide's colours, so it fits every theme; phone cameras read light-on-dark codes too.
:::

---
# Try it on your own computer.

```sh
mdeck run slides.md --network
```

- **Same network** — phones must be able to reach your computer.
- **Lecture hall** — run `mdeck server` on a web server; the slides stay on your laptop.

:::notes
For a lecture hall, run `mdeck server` on a web server once and point the deck's `server` setting at it. The phones only talk to that server; the slides never leave this laptop. The "Ask your audience" guide has the details.

Many university networks keep devices apart. If phones cannot open the page, use a phone hotspot or a server on the internet.
:::
