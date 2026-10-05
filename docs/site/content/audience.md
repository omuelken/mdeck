# Ask your audience

A slide can ask a question that people answer on their phones, with the results appearing on the slide as they come in.

## Add a poll

```markdown
---
# Where do we eat?

<poll room="lunch" options="Mensa|Thai|Pizza|Salad" />
```

The slide shows one bar per option, the number of answers, a QR code and a short link. Scanning the code opens a small answer page on the phone with one button per option. Each phone has one vote and can change it; the bars follow the latest answer.

Every poll in a presentation shows the same code, so people scan once. Their phones then follow along: when you reach a slide with a poll, its buttons appear on every phone; between polls, the phones say that the next question will appear there. You can show the code at the start of the talk, or on the first poll.

| Setting | Meaning |
|---|---|
| `room` | A short name for this question, different for each poll in the deck. Letters, digits, hyphens and underscores. |
| `options` | The answers, separated by `\|` |
| `question` | Optional question text. Without it, phones show the slide's heading. |
| `qr` | `false` leaves out the QR code, when an earlier slide showed it with `<qrcode join />`. |

With `lang: de` in the settings, the slide and the phones show German words, such as “Scannen und abstimmen”. The phones use the presentation's colours and fonts; if you pick another theme or palette in the presenter view, the phones change with it.

## Other kinds of questions

Besides a poll, three more kinds work the same way: one line on a slide, answered on the phones.

```markdown
<scale room="pace" min="1" max="5" low="Too slow" high="Too fast" />
<wordcloud room="mood" placeholder="One word" />
<question room="ask" placeholder="Your question" />
```

| Tag | Phones show | The slide shows |
|---|---|---|
| `<scale>` | The numbers from `min` to `max` (1 to 5 unless set, at most 11 steps), with `low` and `high` as labels at the ends | How many chose each number, and the average. Each phone's latest answer counts |
| `<wordcloud>` | A short text field | A cloud of every answer, packed around the middle, larger the more often it came in and some upright. Capitals and extra spaces do not matter. People may send several. `height` sets its height (520). Colours come from the palette; `--cloud-1` to `--cloud-6` override them |
| `<question>` | A text field | The newest answers as cards, eight unless `limit` says otherwise. People may send several |

All of them take `room`, `question` and `qr` like a poll, and `placeholder` for the text fields.

## Show the code once

Each question shows the QR code unless you say otherwise. To invite everybody once, at the start, put the code on a slide of its own and leave it out of the questions:

```markdown
---
# Take out your phone.

<qrcode join />

---
# How do you make slides today?

<poll room="tools" options="PowerPoint|Keynote|Markdown" qr="false" />
```

`<qrcode join />` shows the presentation's join code large, with the link below it. Phones that scanned it follow along to every question. With `qr="false"`, a question leaves out its own code. Leave the join slide up for a while, or come back to it, for people who arrive late. `size` sets the size of the code on the join slide.

The code is drawn in the slide's colours, so it fits the theme; phone cameras also read light codes on dark slides.

Hover over the results to see **Reset**, which clears the answers, for example before the real session. Only the presenter can reset.

## How phones and slides meet

The phones never load your slides. A small **room server** connects your screen and the phones: your screen tells it which poll is showing and what the phones should display, and the room server shows that on its own answer page, at an address like `example.org/live/482113`. The six digits are the presentation's session code; they stay the same for the whole talk.

So you present from your own computer with `mdeck run`, always with the slides as they are right now, and nothing needs to be uploaded. Only the room server has to be reachable by the phones.

## Try it on your computer

`mdeck run` has a room server built in:

```sh
mdeck run my-talk.md --host
```

`--host` makes it reachable from phones and tablets in the same network, and the QR code then points at your computer. Without `--host`, the slide says so and offers a link to try the answer page in another browser tab on your computer. The launch page shows the join link and the session code too.

Some networks, often large Wi-Fi networks at universities, do not let devices reach each other. If phones cannot open the page, connect your laptop and the phones to a phone hotspot, or use a room server on the internet (below).

## Use it in a real session

For a lecture hall, run the room server once on a web server; it can serve all your presentations. On that server, install mdeck and start it:

```sh
MDECK_LIVE_KEY=choose-a-secret mdeck live
```

It listens on `127.0.0.1:8787`. Make your web server pass one address to it, for example with nginx:

```nginx
location /live/ {
  proxy_pass http://127.0.0.1:8787/;
  proxy_http_version 1.1;
  proxy_set_header Connection "";
  proxy_set_header X-Forwarded-For $remote_addr;
  proxy_buffering off;
  proxy_read_timeout 1h;
}
```

The slides and phones keep a connection open to receive answers live, which is why buffering is off and the timeout long. `X-Forwarded-For` lets the room server limit each phone, not the web server as a whole.

To present from an iPad through the room server with `mdeck run --share` (see [Draw on your slides](drawing.html#present-from-an-ipad)), your web server must also pass WebSocket connections on. Give the room server its own host name, or a whole `server` block, and use these lines in place of the ones above:

```nginx
# in the http block
map $http_upgrade $connection_upgrade { default upgrade; '' ''; }

location / {
  proxy_pass http://127.0.0.1:8787;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection $connection_upgrade;
  proxy_set_header X-Forwarded-For $remote_addr;
  proxy_buffering off;
  proxy_read_timeout 1h;
}
```

Sharing needs `MDECK_LIVE_KEY`: a room server without a key does not offer it, and a laptop that does not know the key cannot open a tunnel. The room server only relays: it keeps nothing of the slides, and a shared presentation disappears when the laptop disconnects or the room server restarts.

To keep the room server running and start it with the machine, a systemd service works well. Put the presenter code in a file only root can read, for example `/etc/mdeck-live.env` with the line `MDECK_LIVE_KEY=choose-a-secret`, and create `/etc/systemd/system/mdeck-live.service`:

```ini
[Unit]
Description=mdeck room server
After=network.target

[Service]
EnvironmentFile=/etc/mdeck-live.env
ExecStart=/usr/local/bin/mdeck live --port 8787
User=www-data
Restart=on-failure
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true

[Install]
WantedBy=multi-user.target
```

Adjust `ExecStart` to where `which mdeck` points; if Node is installed in a home folder, for example with nvm, also remove `ProtectHome=true`. Then run `sudo systemctl enable --now mdeck-live`. `journalctl -u mdeck-live` shows its log. After updating mdeck, `sudo systemctl restart mdeck-live`; rooms start empty again.

Then tell the presentation where the room server is:

```yaml
---
live:
  server: https://example.org/live
---
```

`MDECK_LIVE_KEY` is the presenter code: only a browser that has it can move the phones along and reset polls, so nobody in the audience can. Start `mdeck run` with the same code (`MDECK_LIVE_KEY=choose-a-secret mdeck run my-talk.md`), and the launch page checks the room server, shows the join link and opens the presenter view with the code. The browser remembers it; it never appears in the address bar or in the slide file. Without it, phones wait. The presenter view says whether the phones follow it, and if not, why.

The presenter's screen repeats the current poll every few seconds, so phones that join late, or a room server that restarted, catch up. While a presenter view is open, other windows of the presentation in the same browser leave the phones alone. If the presentation is open on several screens, even in other browsers, the phones follow the one where the slides were changed last; just opening it elsewhere does not take them away. A presenter view that has lost the phones says so, and changing the slide there takes them back.

Two presentations with the same title share a session code. Give one of them `live.id`, or set the digits yourself with `live.code`.

## What is stored

Answers are anonymous. Each phone gets a random number so it can change its vote; nothing else identifies it. The room server keeps answers in memory only. It forgets a room after twelve hours without visitors and everything when it restarts. Each phone can send a limited number of answers in a short time.

## Make your own activity

Polls, scales, word clouds and questions are ordinary components. The [interactive content](components.html#audience-interaction) guide shows how to write your own, such as a quiz.
