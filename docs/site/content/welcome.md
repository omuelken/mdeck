# Make your next presentation.

Bring what you already have: old PowerPoint slides, a PDF, a Word document, a paper, or a page of notes. An AI assistant turns it into a clean, well-designed deck, and mdeck presents it in a web browser, with your notes, and sends it as one file or a PDF.

The content stays yours. The assistant works from your material, not from its own idea of the topic: it chooses layouts, tidies wording, moves detail into speaker notes and checks the file. You do not need to know how to program. The slides are a plain text file, so you can read every word, change any of it yourself, or ask for something different.

[Make your first presentation](getting-started.html)

## What you can do with it

<div class="features">

<section>

[![The presenter view on an iPad with circles, an arrow and a highlight drawn on a chart slide, and the projector behind it showing the same strokes](images/features/drawing.webp)](images/features/drawing.webp)

### Draw on your slides, from an iPad if you like

Circle a number, underline a phrase, point with a laser. Pair an iPad by scanning a code, and it becomes your presenter screen and drawing pad while the laptop drives the projector: every stroke shows on the big screen as you draw. Drawings are kept with the talk, in its PDF too. [Draw on your slides](drawing.html)

</section>

<section>

[![A poll slide with live bars and a QR code, and a phone showing the same question with one answer picked](images/features/polls.webp)](images/features/polls.webp)

### Ask the room, and show the answers on the slide

Polls, scales, word clouds, open questions and numbers to guess. People scan the code and answer on their phones, no app needed, and the bars grow as votes come in. Close the vote, discuss, reveal the right answer. The answers are kept with the talk. [Ask your audience](audience.html)

</section>

<section>

[![A slide with author–year citations and the full references at its foot, next to a slide that lists all references](images/features/citations.webp)](images/features/citations.webp)

### Cite your sources properly

Cite as in a paper, `[@knuth1984, p. 97]`, from the BibTeX, CSL-JSON or Hayagriva file you already keep. Each slide lists what it cites at its foot, and a references slide lists everything, in APA, Vancouver, Harvard or any CSL style. [Cite a source](more-content.html#cite-a-source)

</section>

<section>

[![The same chart slide in six themes: neue, plain, work, academic, minimal and glass](images/features/themes.webp)](images/features/themes.webp)

### Write the content once, change the look anytime

The file holds what you say; a theme and a palette decide how it looks. One line changes every slide, light or dark, and your text never moves. Six themes come with mdeck, more are one command away in the [theme repository](https://gh.tschieber.de/mdeck-themes/). [Change the look](appearance.html)

</section>

<section>

[![A slide with a short Python example and its output below it](images/features/code.webp)](images/features/code.webp)

### Run code on the slide

Give a Python or JavaScript example a Run button, change it in front of the audience and run it again. Python runs right in the browser, with packages such as NumPy and pandas, so nothing needs installing. [Show a code example](more-content.html#show-a-code-example)

</section>

<section>

[![The reader view of a talk on a laptop, with an outline of the slides, and on a phone in reading mode](images/features/reader.webp)](images/features/reader.webp)

### Send one file that anyone can open

`mdeck send` makes a single HTML file for the people you send the talk to: an outline, a reading mode for phones, light and dark, and the PDF inside. It opens in any browser, also offline, and your speaker notes stay out. [Send, host or print](sharing.html)

</section>

</div>

Also: a presenter view with notes, timer and the next slide; points revealed one at a time; pictures, videos and formulas; a browser editor for those who prefer clicking; and a launch page (`mdeck run`) that gathers it all, with a check for missing pictures and slides that do not fit.

<!-- preview -->

## Bring your material, then shape it

Put your files in a folder, open your assistant there, and point it at them:

```prompt
/write-slides Turn lab-notebooks.pptx and my notes in notes.md into
a 15-minute talk for new lab students. Keep my examples, reuse the
photos from the old slides, and add one poll at the start.
```

The assistant reads your files, keeps your structure, facts and pictures, picks a layout for each slide, writes speaker notes from what you wrote, checks the file with mdeck, and tells you how to open it. From there you keep talking: “make slide 4 a big statement”, “use a dark look”, “the third section of the PDF is missing”.

## The slides are a text file

mdeck slides are written in Markdown, the format AI assistants already answer in. That is why they are good at it: no slide software to operate, no file format to reverse-engineer, just the kind of text they write all day. What the assistant writes looks like this:

```markdown
# A small idea

Every good talk starts somewhere.

---

# What comes next?

- Explain the idea.
- Show an example.
- Invite questions.
```

The `#` makes a heading. The line with `---` starts another slide. A dash before a sentence makes a list item. Knowing these few marks lets you fix a word in seconds without asking anyone. [Read and adjust your slides](writing.html) explains the rest.

## Find what you need

- **Starting from scratch?** Follow [Make your first presentation](getting-started.html).
- **Already use an AI assistant?** [Work with an AI assistant](claude-skill.html) shows how to set it up for mdeck and how to ask for good slides.
- **Already have a slide file?** Learn to [add pictures](pictures-and-video.html) or [change the look](appearance.html).
- **Getting ready to speak?** Set up [your notes and audience screen](notes-and-presenting.html).
- **Want the room to take part?** [Ask your audience](audience.html) with polls, scales, word clouds and open questions they answer on their phones.
- **Want to mark up a slide?** [Draw on your slides](drawing.html) with a pen, a finger or an iPad pencil, live or ahead of time.
- **Sending your talk to someone?** Choose a [sharing or printing option](sharing.html).
- **Which view or server do I need?** See [Views, commands and servers](views.html).
- **Something looks wrong?** Try [the troubleshooting guide](troubleshooting.html).

## Your file, whoever edits it

Whoever writes the slides, your assistant, a text editor, or the built-in browser editor (`mdeck edit`), the file stays the single copy, and the preview updates as it changes. mdeck can also use layouts, themes and colours made for your team, and your assistant can make new ones for a single talk.

## Keep this guide nearby

Open these pages again with:

```sh
mdeck docs
```

The documentation runs on your own computer. No account or hosted service is needed.
