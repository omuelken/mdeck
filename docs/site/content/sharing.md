# Share or print your slides

The launch page that `mdeck dev my-talk.md` opens has buttons for the three most common results: a folder to host, one file to send, and a PDF. Each is made next to your slide file. The commands below do the same from the terminal and offer more options.

## Send slides to someone

The quickest way to share slides with people who were not in the room:

```sh
mdeck build my-talk.md --share --self-contained -o my-talk.html
```

Send `my-talk.html` by email. It opens in a **reader view**: an outline of all slides on the left, the slides in the middle, a **Read** mode that stacks every slide for scrolling on a phone, a **Look** menu to try other themes and colors, a **Download PDF** button, and a **Present** button that opens the full-screen deck.

- Your speaker notes are removed from a `--share` build. Add `--with-notes` to keep them in the file, for example when you also present from the same link. Readers only see notes if you put `share:` with `notes: true` in the settings at the top of your slide file.
- The PDF is made while building, using Chrome or Chromium on your computer. If neither is found, the button offers the browser's own "Save as PDF" dialog instead. Set `MDECK_CHROME` to the browser's path if it is installed somewhere unusual.
- Leave out `--self-contained` to get a folder with the HTML, the media files and `deck.pdf` side by side, which stays smaller when the talk has videos.
- To stop recipients changing the look, put `share:` with `themes: false` in the settings at the top of your slide file.

Anyone who opens a normal build can reach the reader view through the small **Overview** link in the corner, or by adding `?view=share` to the address. [Views, commands and servers](views.html) lists every view. Likewise `?view=presenter` opens the presenter view of any build, as long as the notes were kept in the file.

## Make a PDF on its own

```sh
mdeck pdf my-talk.md
mdeck pdf my-talk.md -o handout.pdf
```

Each slide becomes one page at the slide's own size, with real text you can search and copy. Points that appear one at a time are all shown, and interactive slides such as diagrams that build up step by step appear finished. The reader's **Read** mode shows them the same way.

While you write, mdeck reads your text file. To send the presentation to someone else, **build** it: ask mdeck to make a browser-ready version of your talk.

## Make a folder you can share

```sh
mdeck build my-talk.md
```

mdeck creates a folder called `dist`. It contains `index.html` and the local pictures, videos, and audio files the presentation uses.

Send the whole folder, not just `index.html`. You can compress the folder into a ZIP file first. This option is usually best for talks with large videos.

Building again updates the output. Keep your original slide file and pictures outside `dist`, because mdeck replaces the build output.

## Make one HTML file

If you need one file to transfer, use:

```sh
mdeck build my-talk.md --self-contained -o my-talk.html
```

Here, `-o` means “save the result with this name.” The file contains the presentation and embedded local media. Videos become larger when embedded, so a folder is often more convenient for a video-heavy talk.

The recipient can open the HTML file in a modern browser. External websites, online videos, and downloadable tools such as live Python still need a network connection. Fonts may look slightly different because this mode uses the theme's system-font alternatives.

## Make a PDF

Open the built presentation in your browser. Choose **Print**, then **Save as PDF**. Each slide becomes a page. Turn off the browser's own headers and footers if they appear.

A PDF is useful for reading or printing. Videos do not play in it, and interactive slides are shown in their finished state. A poll shows the answers it had when the PDF was made.

## Present without installing mdeck

You can include small launchers with a folder build:

```sh
mdeck build my-talk.md --presenter-launchers
```

The folder then includes `present.sh` for macOS/Linux, and `present.bat` plus `present.ps1` for Windows. These start a local web server and open the presenter view. The other computer needs Python 3 and a modern browser.

Use this with a folder build; it cannot be combined with `--self-contained`.

## Put the presentation on a website

The built folder can be hosted as an ordinary static website. Upload its contents together so the relative image and video paths keep working. Every build contains every view; the address picks it: `?view=deck`, `?view=share`, `?view=presenter` or `?view=audience`. The short forms `?v=d`, `?v=s`, `?v=p` and `?v=a` mean the same. Phones that scan a poll's QR code open `?view=respond`; for polls in a hosted presentation, also see [Ask your audience](audience.html#use-it-in-a-real-session).

Building does not publish anything automatically. Uploading or deploying the files is a separate step with your hosting provider.

## Check before sharing

Open the final result, try its images and videos, and make sure the whole talk is there. If you expect to be offline, test without an internet connection.

Remember that speaker notes are included in the presentation file, even though they are hidden on the audience screen. Remove anything confidential before building a public copy.
