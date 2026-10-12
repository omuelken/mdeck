# Install mdeck

Three commands in a terminal, a few minutes in all. mdeck is published on npm, the package registry for JavaScript tools, as [mdeck](https://www.npmjs.com/package/mdeck).

A terminal is an app where you type short commands: Terminal on macOS, or PowerShell on Windows. A text editor may also have a Terminal menu.

## 1. Install Node.js

mdeck runs on [Node.js](https://nodejs.org) 22 or newer, which brings npm along. Check whether you have it:

```sh
node --version
```

A number of 22 or higher is enough. If the command is not found or the number is lower, install the LTS version from [nodejs.org](https://nodejs.org).

## 2. Install mdeck

```sh
npm install -g mdeck
```

Check that it is ready:

```sh
mdeck --help
```

## 3. Teach your AI assistant

```sh
mdeck skill --install claude
```

This installs a *skill*: instructions that tell your assistant how mdeck slides are written, which layouts and looks exist, and how to check its work. Write `codex`, `cursor`, `copilot` or `gemini` instead of `claude` for those assistants; for Cursor, Copilot and Gemini, run it in your talk's folder. `mdeck skill` shows the list, and [Work with an AI assistant](claude-skill.html) says more.

Then [make your first presentation](getting-started.html).

## Update, check or remove

| To | Run |
|---|---|
| Update to the newest version | `npm install -g mdeck` |
| See which version you have | `npm list -g mdeck` |
| Remove mdeck | `npm uninstall -g mdeck` |

What each version brings is in the [changelog](https://github.com/tilman-schieber/mdeck/blob/main/CHANGELOG.md) and the [releases](https://github.com/tilman-schieber/mdeck/releases). After an update, run `mdeck skill --install claude` again, so your assistant knows the new features.

If `npm` or `mdeck` is not found, see [When something goes wrong](troubleshooting.html#the-command-is-not-recognized).
