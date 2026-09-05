# Share or print your slides

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

A PDF is useful for reading or printing. Videos and interactive activities do not run in it.

## Present without installing mdeck

You can include small launchers with a folder build:

```sh
mdeck build my-talk.md --presenter-launchers
```

The folder then includes `present.sh` for macOS/Linux, and `present.bat` plus `present.ps1` for Windows. These start a local web server and open the presenter view. The other computer needs Python 3 and a modern browser.

Use this with a folder build; it cannot be combined with `--self-contained`.

## Put the presentation on a website

The built folder can be hosted as an ordinary static website. Upload its contents together so the relative image and video paths keep working. The presenter view is available by adding `?presenter=1` to the page address.

Building does not publish anything automatically. Uploading or deploying the files is a separate step with your hosting provider.

## Check before sharing

Open the final result, try its images and videos, and make sure the whole talk is there. If you expect to be offline, test without an internet connection.

Remember that speaker notes are included in the presentation file, even though they are hidden on the audience screen. Remove anything confidential before building a public copy.
