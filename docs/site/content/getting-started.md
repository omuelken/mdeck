# Make your first presentation

You will give your AI assistant material you already have and open the deck it makes.

First [install mdeck](install.html) and the skill for your assistant, if you have not yet. It takes a few minutes.

## Hand over your material

Make a folder for your talk and copy in what you have: old slides, a PDF, a Word document, photos, or rough notes. Open your assistant in that folder and tell it what to make from them, for whom, and how long:

```prompt
/write-slides Make a 10-minute talk for our team from report.docx and
the photos in img/. It is about what we learned from the spring
garden project. Keep my three main points, in English.
```

In other assistants than Claude Code and Gemini CLI, simply ask for an mdeck presentation. The assistant writes a deck such as `spring-garden.md` from your files, checks it, and tells you what to do next.

No material yet? Describing the talk works too; the assistant then drafts the content as well, and you have more to check.

## Open the preview

In a terminal opened in your talk's folder, run:

```sh
mdeck run spring-garden.md
```

Your browser opens the launch page for your talk. Click **Audience window** to see just the slides, or **Presenter view** for notes, drawing controls and a timer. Press the right arrow key to move to the next slide, and the left arrow key to go back. Press **F** to go fullscreen.

Keep the terminal open while working. If the browser does not open, click or copy the launch page address shown in the terminal. It usually is `http://localhost:5173/`. The [command guide](commands.html#the-launch-page) describes everything else on the launch page.

## Make it yours

Read through every slide and its notes, next to your original material. Check that nothing important was dropped and nothing was added that you did not say. Then tell the assistant what to change:

```prompt
Slide 3 is too dense; split it in two. You left out the part about
the tomato beds from page 4 of the report. Make the closing slide a
big statement.
```

The preview reloads each time the file changes. Small things, such as a word or a number, are often quicker to change yourself: open the `.md` file in any text editor and save. [Read and adjust your slides](writing.html) explains what you will see in the file.

That is the everyday workflow: ask, look at the preview, adjust. When you are finished, press `Ctrl+C` in the terminal to stop it.

## Prefer to start without an assistant?

Run:

```sh
mdeck new
```

mdeck asks for a file name, a theme, colors, and some starting slide layouts. Press Enter to accept a suggested answer. Replace the example words in the new file with your own. The starter may mention a logo image. Add that image, or remove the `logo:` line if you do not want a logo.

Or make the file yourself: save a new plain-text file called `my-talk.md` (not `my-talk.md.txt`), paste this in, and run `mdeck run my-talk.md`:

```markdown
# My first presentation

Hello, everyone!

---

# Three things to remember

- Start with one idea.
- Show a helpful example.
- Leave time for questions.
```

Next, learn [how to work with your assistant](claude-skill.html) or [choose a layout](layouts.html).
