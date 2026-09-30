# Make your first presentation

You will make a small text file, open its preview, and change your first slide. If mdeck is already installed on your computer, skip straight to “Make a slide file.”

## Set up mdeck once

mdeck needs Node.js and npm on your computer. Install [Node.js](https://nodejs.org) (version 22 or newer); npm comes with it.

Open a terminal. A terminal is an app where you type short commands: Terminal on macOS, or PowerShell on Windows. A text editor may also have a Terminal menu.

Run these two commands, one at a time. The first tells npm where FHNW publishes mdeck; the second installs it:

```sh
npm config set @tilman.schieber:registry https://gitlab.fhnw.ch/api/v4/packages/npm/
npm install -g @tilman.schieber/mdeck
```

You normally do this only once. To update later, run the second command again.

Check that the command is ready:

```sh
mdeck --help
```

If your computer does not recognize `npm` or `mdeck`, see [When something goes wrong](troubleshooting.html#the-command-is-not-recognized).

## Make a slide file

Make a folder for your talk. Open it in a plain-text editor, and save a new file called `my-talk.md`. Use a text editor rather than Word or Pages. If your editor asks, choose plain text.

The `.md` ending means the file contains **Markdown**: ordinary text with a few marks that say “this is a heading” or “this is a list.” You will learn those marks as you use them.

Paste this into the file:

```markdown
# My first presentation

Hello, everyone!

---

# Three things to remember

- Start with one idea.
- Show a helpful example.
- Leave time for questions.
```

Save the file. Make sure its name ends in `.md`, not `.md.txt`.

## Open the preview

In a terminal opened in your talk's folder, run:

```sh
mdeck dev my-talk.md
```

Your browser opens the launch page for your talk. Click **Full-screen deck** to see the slides. Press the right arrow key to move to the second slide, and the left arrow key to go back.

Keep the terminal open while working. If the browser does not open, click or copy the launch page address shown in the terminal. It usually is `http://localhost:5173/`. The [command guide](commands.html#the-launch-page) describes everything else on the launch page.

## Make a change

Change “My first presentation” to the title of your own talk. Save the file. The slides reload with your new title.

That is the everyday workflow: write, save, and look at the preview. When you are finished, press `Ctrl+C` in the terminal to stop it.

## Prefer a starting point?

Instead of making the file yourself, run:

```sh
mdeck new
```

mdeck asks for a file name, a theme, colors, and some starting slide layouts. Press Enter to accept a suggested answer. Replace the example words in the new file with your own.

The starter may mention a logo image. Add that image, or remove the `logo:` line if you do not want a logo.

Next, learn [how to write your slides](writing.html) or [choose a layout](layouts.html).
