# Make your next presentation.

Bring what you already have: old PowerPoint slides, a PDF, a Word document, a paper, or a page of notes. An AI assistant turns it into a clean, well-designed deck, and mdeck presents it in a web browser, with your notes, and sends it as one file or a PDF.

The content stays yours. The assistant works from your material, not from its own idea of the topic: it chooses layouts, tidies wording, moves detail into speaker notes and checks the file. You do not need to know how to program. The slides are a plain text file, so you can read every word, change any of it yourself, or ask for something different.

[Make your first presentation](getting-started.html)

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

## What mdeck does today

mdeck gives you ready-made slide layouts, different visual themes, speaker notes, pictures, videos, a separate presenter view, drawing on slides (also from an iPad), polls and other questions your audience answers on their phones, and a reader view with a PDF for people you send the slides to. It can also use layouts, themes and colors made for your team, and your assistant can make new ones for a single talk.

`mdeck run` opens a launch page for your talk with all of this in one place: the presenter view, the editor, these guides, buttons that make the files to share, and a check for missing pictures.

Whoever writes the slides, your assistant, a text editor, or the built-in browser editor (`mdeck edit`), the file stays the single copy, and the preview updates as it changes.

## Keep this guide nearby

Open these pages again with:

```sh
mdeck docs
```

The documentation runs on your own computer. No account or hosted service is needed.
