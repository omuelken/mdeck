---
theme: neue
meta:
  title: Deck-local layouts
---

---
:::meta
layout: comparison
id: deployment-options
props:
  ratio: [2, 3]
  emphasis: right
:::
# Deployment options

:::slot left
## Directory bundle

- Separate media files
- Suitable for large videos
:::

:::slot right
## Single HTML file

:::tip
Handy when one file is easier to pass on than a folder.
:::

- All local assets embedded
- Larger video payloads
:::

:::notes
This layout is not built into mdeck: it comes from `extensions/comparison/` beside this deck. `ratio` sets the widths of the two sides, `emphasis` which one stands out.
:::

---
:::meta
layout: split
id: built-in-regions
props:
  ratio: [1, 1]
:::
# A layout of your own

:::slot left
```markdown
:::meta
layout: comparison
props:
  emphasis: right
:::
# Deployment options
:::slot left
## Directory bundle
:::
```
:::

:::slot right
:::steps
- `extension.toml` names the layout, its areas and its settings.
- `layout.jsx` places the areas, `styles.css` styles them.
- A slide chooses it with `layout: comparison`.
:::
:::

:::notes
All three files are in `extensions/comparison/`. `mdeck list layouts` shows the deck's own layouts beside mdeck's, and `mdeck starter comparison` prints a slide to start from. To use the layout in other decks, install it once for all of them; the guide "Reusable layouts" shows how.
:::
