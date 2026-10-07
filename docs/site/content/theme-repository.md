# Install or share a theme

Besides the themes and palettes that come with mdeck, other people share theirs in the **theme repository**: <https://github.com/tilman-schieber/mdeck-themes>. A shared theme or palette comes as a **pack**: one theme with the palettes made for it, or a set of palettes.

## Find and install one

See what there is:

```sh
mdeck themes search
mdeck themes search warm
```

Install a pack beside your slides:

```sh
mdeck themes install solarized my-talk.md
```

It is copied into the `extensions` folder next to `my-talk.md`, like a theme you made yourself, so the slide folder keeps working on any computer. Then choose it in the deck settings (`palette: solarized`) or in the editor's **Deck** tab.

The design page has the repository too: open it with `mdeck design my-talk.md`, and under **From the theme repository** press **Show what others made**. Each pack shows a picture and an **Install** button.

## For every deck

With `--global`, a pack is installed once for all your decks, in a folder in your home folder (`~/.mdeck/extensions`):

```sh
mdeck themes install solarized --global
```

A slide file that uses it works only on your computer. `mdeck check` reminds you, and `mdeck themes install solarized my-talk.md` puts a copy beside the slides. When a deck has its own copy, that one is used.

## Update and remove

```sh
mdeck themes list my-talk.md       # what is installed, here and for every deck
mdeck themes update my-talk.md     # newer versions of everything installed here
mdeck themes remove solarized my-talk.md
```

Add `--global` to work on the packs for every deck. If you changed an installed file by hand, `update` and `remove` stop and tell you which one, so your change is not lost; add `--force` to go ahead anyway.

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
mdeck = ">=2.3.0"
```

3. Check it the way the repository will: `mdeck themes build packs -o site --check` shows every theme and palette in the pack on every kind of slide, light and dark, and fails on text that does not fit or is hard to read.
4. Open a pull request. Once it is merged, `mdeck themes search` lists it. For a new version, raise `version` in `pack.toml`.
