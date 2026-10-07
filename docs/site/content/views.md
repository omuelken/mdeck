# Views, commands and servers

mdeck has a few commands that start a server or make files, and a few views of the same slides that you choose in the browser. This page puts them side by side.

## Views

Every build and every preview contains all views. The address picks one with `?view=`:

| Address | View | For |
|---|---|---|
| `?view=deck` | Standalone slides with drawing controls | Slides opened from the reader view or a built file |
| `?view=presenter` | Current and next slide, notes and timer, and a button that opens the audience window | You, while presenting |
| `?view=audience` | Slides without notes, with navigation synced to the presenter view | The projector |
| `?view=reader` | The reader view: an outline, **Slides** and **Read** modes, light or dark, and a PDF | People you send the talk to |
| `?view=follow` | The slide you are showing and your drawing, live; people can page back and return with **Back to live**, but never see a slide before you show it | People in the room, on their phone or laptop |

Ways to switch between them:

- The **Overview** link in the corner of the deck opens the reader view. Its outline is the overview of all slides.
- **Present** in the reader view opens standalone slides at the current slide.
- People in the room open the follow view with `<qrcode follow />` on a slide, with the **Follow the slides** link on the phones' answer page, or with the **Follow** address `mdeck run --network` prints. It works where their devices reach both the slides and your stage room: on the same network with `mdeck run --network`, or anywhere for a deck hosted with a `server` setting.
- The presenter view's audience-window button opens the audience view in a new window. Navigation in either window updates the other, in the same browser or on a paired iPad: see [Draw on your slides](drawing.html#present-from-an-ipad).
- The launch page of `mdeck run`, at the preview's plain address, offers Presenter, Audience and Reader. Its presenter and audience buttons belong together.
- Fullscreen is a control inside a view (**F** or its fullscreen button). For a single screen, use the presenter view's slide-only layout.
- A poll's QR code opens the server's answer page, not the slides: see [Ask your audience](audience.html).

## Commands

| Command | What it does | Where it runs |
|---|---|---|
| `mdeck run my-talk.md` | Preview that reloads when you save; launch page; server for polls | Your computer. Add `--network` to reach it from phones in the same network, or `--server` to reach it from an iPad on any network through your own server |
| `mdeck edit my-talk.md` | Visual editor that saves into the file and keeps a backup | Your computer only. The launch page can start it too |
| `mdeck build my-talk.md` | A `dist` folder to host or copy | Anywhere afterwards; no mdeck needed |
| `mdeck send my-talk.md` | One file to send, without notes, with a PDF inside | Opens on its own |
| `mdeck pdf my-talk.md` | A PDF, one page per slide | Needs Chrome or Chromium while building |
| `mdeck server` | The server for polls in hosted presentations, and for presenting from an iPad through it | A web server |
| `mdeck docs` | These guides | Your computer |

The [command guide](commands.html) lists every option.

## What needs a server

**Presenting.** While you work, use `mdeck run`. A built folder can be presented from any ordinary web server; `mdeck build my-talk.md --launchers` adds a small one that needs Python. A self-contained file for readers opens on its own.

**Editing and the launch page.** These run only while `mdeck edit` or `mdeck run` is running, and only answer on your own computer.

**Polls.** Only a server must be reachable by the phones; they never load the slides. You present from your own computer, with the slides as they are right now.

| Situation | Server | Settings |
|---|---|---|
| Rehearsing, small group | Built into `mdeck run my-talk.md --network` on your laptop | None. Phones must be in the same network |
| Lecture hall | `mdeck server` on a web server, once for all your talks | `server`, and the key `MDECK_SERVER_KEY` when you start `mdeck run` |

Many large Wi-Fi networks do not let devices reach each other. If phones cannot reach your laptop, use a phone hotspot or a server on the internet. Details are in [Ask your audience](audience.html).

**Drawings.** `mdeck run` saves them in `my-talk.drawings.json` next to the slides. An iPad next to your laptop pairs with `mdeck run --network` through a QR code on the launch page, or from any network with `mdeck run --server`; the audience window on the laptop then follows it. See [Draw on your slides](drawing.html).

**PDFs.** Only building one needs Chrome. The PDF shows interactive slides finished. Polls show the answers the deck's `server` had at that moment; without one, they show their question and options, marked as answered live during the talk.
