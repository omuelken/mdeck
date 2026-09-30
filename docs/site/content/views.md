# Views, commands and servers

mdeck has a few commands that start a server or make files, and a few views of the same slides that you choose in the browser. This page puts them side by side.

## Views

Every build and every preview contains all views. The address picks one with `?view=`, or the short form `?v=`:

| Address | View | For |
|---|---|---|
| `?view=deck` or `?v=d` | The slides alone, full screen | Rehearsing, or a single screen |
| `?view=presenter` or `?v=p` | Current and next slide, notes and timer, and a button that opens the audience window | You, while presenting |
| `?view=audience` or `?v=a` | The slides, following the presenter view | The projector |
| `?view=share` or `?v=s` | The reader view: an outline, **Slides** and **Read** modes, a **Look** menu and a PDF | People you send the talk to |
| `?view=respond` or `?v=r` | The answer page for polls, following the presenter | Phones in the audience |

Ways to switch between them:

- The **Overview** link in the corner of the deck opens the reader view. Its outline is the overview of all slides.
- **Present** in the reader view opens the full-screen deck at the current slide.
- The presenter view's audience-window button opens the audience view in a new window. The two stay in step, in the same browser on the same computer.
- The launch page of `mdeck dev`, at the preview's plain address, has a button for each view. Its presenter and audience buttons belong together, so the audience window follows that presenter view.
- A slide's QR code for a poll opens the answer page.

## Commands

| Command | What it does | Where it runs |
|---|---|---|
| `mdeck dev my-talk.md` | Preview that reloads when you save; launch page; room server for polls | Your computer. Add `--host` to reach it from phones in the same network |
| `mdeck present my-talk.md` | The same server, opening the presenter view | Your computer |
| `mdeck edit my-talk.md` | Visual editor that saves into the file and keeps a backup | Your computer only. The launch page can start it too |
| `mdeck build my-talk.md` | A `dist` folder to host or copy | Anywhere afterwards; no mdeck needed |
| `mdeck build my-talk.md --share --self-contained -o my-talk.html` | One file to send, without notes, with a PDF inside | Opens on its own |
| `mdeck pdf my-talk.md` | A PDF, one page per slide | Needs Chrome or Chromium while building |
| `mdeck live` | A room server for polls in hosted presentations | A web server |
| `mdeck docs` | These guides | Your computer |

The [command guide](commands.html) lists every option.

## What needs a server

**Presenting.** While you work, use `mdeck dev` or `mdeck present`. A built folder can be presented from any ordinary web server; `mdeck build my-talk.md --presenter-launchers` adds a small one that needs Python. A self-contained file for readers opens on its own.

**Editing and the launch page.** These run only while `mdeck edit` or `mdeck dev` is running, and only answer on your own computer.

**Polls.** Two things must be reachable: the slides, for the phones, and a room server, for every device.

| Situation | Slides come from | Room server | Settings |
|---|---|---|---|
| Rehearsing, small group | `mdeck dev my-talk.md --host` on your laptop | Built into `mdeck dev` | None. Phones must be in the same network |
| Lecture hall | A web server hosting the built deck | `mdeck live` on a web server | `live.server`, and `live.audience` if you present from another address |

For a room server of your own, open the presentation once with `?livekey=…` on the computer you present from, so it can move the phones to each poll and reset polls. Details are in [Ask your audience](audience.html).

Many large Wi-Fi networks do not let devices reach each other. If phones cannot open the slides from your laptop, use a phone hotspot or the hosted setup.

**PDFs.** Only building one needs Chrome. The PDF shows interactive slides finished, and polls with the answers they had at that moment.
