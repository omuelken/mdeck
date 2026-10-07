# Install, remove or share a theme

Every theme and palette in mdeck comes in a **pack**: one theme with the palettes made for it, or a set of palettes. A few packs come with mdeck: `neue`, `academic`, `aurora` and `minimal`, each a theme with its own palette, and the palette `lagoon`. They work right away, also without an internet connection. More packs are in the **theme repository**; try them all on a sample deck at <https://gh.tschieber.de/mdeck-themes/>.

## Find and install one

See what there is:

```sh
mdeck themes search
mdeck themes search warm
```

Install a pack:

```sh
mdeck themes install duet
```

It is installed for every deck on this computer, in a folder in your home folder (`~/.mdeck/extensions`). Then choose it at the top of a slide file (`theme: duet`) or in the editor's **Deck** tab. Some packs need another pack, for example for a palette their theme uses; `install` brings that one along.

The design page has the same: open it with `mdeck design`, choose **Show what you can install**, and press **Install** under a pack.

## Beside one deck

Give a slide file (or the folder it is in) to put the pack into the `extensions` folder next to it instead:

```sh
mdeck themes install duet my-talk.md
```

The slide folder then carries the theme, so it works on a computer where the pack is not installed, for example when you send a colleague the folder. A deck's own copy is used before one installed for every deck. Files made with `mdeck send`, `mdeck build` or `mdeck pdf` always carry their theme, wherever it came from.

## Update and remove

```sh
mdeck themes list                  # what comes with mdeck, and what is installed
mdeck themes update                # newer versions of everything installed
mdeck themes remove duet
```

Add a slide file, or `--local`, to work on the packs beside that deck. If you changed an installed file by hand, `update` and `remove` stop and tell you which one, so your change is not lost; add `--force` to go ahead anyway. A pack that another installed pack needs stays until that one is removed.

The packs that come with mdeck can be removed too: `mdeck themes remove aurora` hides it from every deck and from the lists. `mdeck themes install aurora` brings it back, without needing the internet. A deck that sets no theme uses `neue`; if you removed it, mdeck tells you to install it again or to choose another theme. The last theme cannot be removed: install another one first.

## What a pack may contain

Packs hold only theme and palette settings (`extension.toml`) and theme stylesheets (`styles.css`). They never contain code that runs in your slides. Fonts may come only from Google Fonts or Bunny Fonts, and stylesheets may not load anything from the web. mdeck checks this again when it installs a pack, and refuses a pack that does not match the checksum the repository lists for it.

## Share your own

1. Make the theme or palette as described in [Create a theme or palette](theme-authoring.html), and fine-tune it with `mdeck design`.
2. Fork the theme repository and add a folder `packs/<your-pack>/` with a `pack.toml` and one folder per theme or palette:

```text
packs/
  harbour/
    pack.toml
    harbour/             a theme
      extension.toml
      styles.css
    harbour-night/       its palette
      extension.toml
```

```toml
schema = 1
id = "harbour"
title = "Harbour"
description = "Navy and brass, with a serif for headings."
version = "1.0.0"
author = "Your Name"
license = "MIT"
mdeck = ">=3.0.0"
```

   A pack whose theme uses a palette from another pack names that pack: `requires = ["lagoon"]`.

3. Check it the way the repository will: `mdeck themes build packs -o site --check` shows every theme and palette in the pack on every kind of slide, light and dark, and fails on text that does not fit or is hard to read.
4. Open a pull request. Once it is merged, `mdeck themes search` lists it. For a new version, raise `version` in `pack.toml`.
