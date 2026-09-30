# Ask your audience

A slide can ask a question that people answer on their phones, with the results appearing on the slide as they come in.

## Add a poll

```markdown
---
# Where do we eat?

<poll room="lunch" options="Mensa|Thai|Pizza|Salad" />
```

The slide shows one bar per option, the number of answers and a QR code. Scanning the code opens a page on the phone with one button per option. Each phone has one vote and can change it; the bars follow the latest answer.

Every poll in a presentation shows the same QR code, so people scan once. Their phones then follow along: when you reach a slide with a poll, its buttons appear on every phone; between polls, the phones say that the next question will appear there. You can leave the code on a title slide at the start, or show it on the first poll.

| Setting | Meaning |
|---|---|
| `room` | A short name for this question, different for each poll in the deck. Letters, digits, hyphens and underscores. |
| `options` | The answers, separated by `\|` |
| `question` | Optional question text. Without it, phones show the slide's heading. |

With `lang: de` in the settings, the slide and the phones show German words, such as “Scannen und abstimmen”.

Hover over the results to see **Reset**, which clears the answers, for example before the real session. Only the presenter's computer can reset.

## Try it on your computer

```sh
mdeck dev my-talk.md --host
```

`--host` makes the slides reachable from phones and tablets in the same network. The QR code then points at your computer. Without `--host`, the slide says that phones cannot reach it.

Some networks, often large Wi-Fi networks at universities, do not let devices reach each other. If phones cannot open the page, use a room server on the internet instead (below), or connect your laptop and the phones to a phone hotspot.

## Use it in a real session

For a lecture hall, host the presentation and a small room server on a web server. Start the room server there:

```sh
MDECK_LIVE_KEY=choose-a-secret mdeck live
```

It listens on `127.0.0.1:8787`. Make your web server pass one address to it, for example with nginx:

```nginx
location /live/ {
  proxy_pass http://127.0.0.1:8787/;
  proxy_buffering off;
  proxy_read_timeout 1h;
}
```

Then tell the deck where the room server and the hosted slides are:

```yaml
---
live:
  server: https://example.org/live
  audience: https://example.org/slides/my-talk/
---
```

`audience` is where phones open the slides. Leave it out when you present from the hosted address itself.

On your presenting computer, open the presentation once with `?livekey=choose-a-secret` added to its address. If you prepare with `mdeck dev`, start it with the same key (`MDECK_LIVE_KEY=choose-a-secret mdeck dev my-talk.md`): its launch page then checks the room server, shows the link for viewers and has a link to the presenter view with the code. The key is remembered in that browser only. With it, your screen tells the phones which poll is showing, and you can reset polls. Without it, phones cannot follow along and instead offer a list of the presentation's questions.

## What is stored

Answers are anonymous. Each phone gets a random number so it can change its vote; nothing else identifies it. The room server keeps answers in memory only. It forgets a room after twelve hours without visitors and everything when it restarts. Each phone can send a limited number of answers in a short time.

## Make your own activity

A poll is an ordinary component. The [interactive content](components.html#audience-interaction) guide shows how to write your own, such as a word cloud or a question box.
