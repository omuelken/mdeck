---
theme: terminal
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
Useful when transferring one file is operationally important.
:::

- All local assets embedded
- Larger video payloads
:::

:::notes
This layout is loaded from extensions/comparison beside this deck.
:::

---
:::meta
layout: split
id: built-in-regions
props:
  ratio: [1, 2]
:::
# Built-in layouts use the same region model

:::slot left
```js
const template = 'comparison'
```
:::

:::slot right
:::steps
- Define a manifest.
- Write a Preact layout.
- Use it from Markdown.
:::
:::
