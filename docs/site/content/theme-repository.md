# Install, remove or share a theme

mdeck comes with four themes, `neue`, `academic`, `aurora` and `minimal`, and five palettes, `swiss`, `nordic`, `neon`, `paper` and `lagoon`. They work right away, also without an internet connection. More themes and palettes are in the **theme repository**; try every one on a sample deck, light and dark, at <https://gh.tschieber.de/mdeck-themes/>.

## Find and install one

Themes and palettes each have their own command, with the same words:

```sh
mdeck themes search
mdeck themes search warm
mdeck palettes search
```

Install a theme:

```sh
mdeck themes install duet
```

A theme comes with its default palette, so this installs the palette `cobalt` too. A palette installs on its own:

```sh
mdeck palettes install solarized
```

They are installed for every deck on this computer, in a folder in your home folder (`~/.mdeck/extensions`). Then choose one at the top of a slide file (`theme: duet`, `palette: solarized`) or in the editor's **Deck** tab.

The design page has the same: open it with `mdeck design`, choose **Show what you can install**, and press **Install** beside a theme or palette.

## Beside one deck

Give a slide file (or the folder it is in) to put it into the `extensions` folder next to it instead:

```sh
mdeck themes install duet my-talk.md
```

The slide folder then carries the theme and its palette, so it works on a computer where they are not installed, for example when you send the folder to a colleague.

## Update and remove

```sh
mdeck themes list                  # what comes with mdeck, and what is installed
mdeck themes update                # newer versions of the installed themes
mdeck palettes update
mdeck themes remove duet
mdeck palettes remove cobalt
```

Add a slide file, or `--local`, to work beside that deck. If you changed an installed file by hand, `update` and `remove` stop and tell you which one, so your change is not lost; add `--force` to go ahead anyway.

A palette that an installed theme uses by default stays until that theme is removed. A palette made for one theme only (like FHNW's `brand`) comes and goes with that theme.

The themes and palettes that come with mdeck can be removed too: `mdeck themes remove aurora` hides it from every deck and from the lists, and `mdeck themes install aurora` brings it back, without the internet. The last theme always stays. A deck without a `theme:` setting uses `neue`; if you removed it, `mdeck check` tells you.

## What may be in one

A theme holds only its settings (`extension.toml`) and its stylesheet (`styles.css`); a palette only its settings. They never contain code that runs in your slides. Fonts may come only from Google Fonts or Bunny Fonts, and stylesheets may not load anything from the web. mdeck checks this again when it installs one, and refuses one that does not match the checksum the repository lists for it.

## Share your own

1. Make the theme or palette as described in [Create a theme or palette](theme-authoring.html), and fine-tune it with `mdeck design`.
2. Fork the theme repository and add it as a folder of its own, `themes/<id>/` or `palettes/<id>/`:

```text
themes/
  harbour/
    extension.toml
    styles.css
palettes/
  harbour-night/
    extension.toml
```

   with a few more settings at the top of `extension.toml`:

```toml
version = "1.0.0"
author = "Your Name"
license = "MIT"
mdeck = ">=4.0.0"
```

   A theme names its default palette (`palette = "harbour-night"`); it must be in the repository or come with mdeck, and is installed along with the theme.

3. Check it the way the repository will: `mdeck themes build . -o site --check` shows every theme and palette on every kind of slide, light and dark, and fails on text that does not fit or is hard to read.
4. Open a pull request. Once it is merged, `mdeck themes search` or `mdeck palettes search` lists it. For a new version, raise `version`.
