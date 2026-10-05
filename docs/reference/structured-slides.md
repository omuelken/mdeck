# Structured slides and validation

Existing decks keep their `---` frontmatter syntax. Code fences protect literal
`---` and `:::notes` examples. A deck can also start directly with Markdown.
Legacy slide metadata is recognized by a known field at the start of the block
(such as `layout:`, `section:` or `image:`). For arbitrary metadata, or to remove
that ambiguity, use an explicit metadata block at the start of a slide:

```markdown
---
:::meta
layout: split
id: deployment-options
:::
# Deployment options

:::slot left
## Directory bundle
- Separate media files
:::

:::slot right
## Single HTML file
- Easy to transfer
:::

:::notes
Explain the tradeoff.
:::
```

`:::meta` belongs to the slide, while the optional initial deck configuration
continues to use YAML between `---` lines. Put a blank line before a directive
when combining it with ordinary Markdown. Directives can nest: for example, a
callout inside columns inside a slot. `+++` separates columns only at that
column block's top level. Slots, notes and metadata are top-level slide blocks.

Unassigned Markdown is the `body` region. `split` accepts `left` and `right`
regions with the shared body above them; without named regions it retains the
legacy first-block-left behavior. An explicit `:::slot body` is also supported,
but cannot be combined with unassigned content. Duplicate or unclosed regions
are errors. Layouts declare the other regions they accept.

Set `id:` for a durable link such as `#deployment-options`. Numeric links such
as `#3` remain supported. Without an authored ID, the parser assigns positional
IDs (`slide-1`, etc.); these are not stable across reordering.

Run `mdeck check talk.md` to validate YAML, dimensions, IDs, metadata and local
asset references. `--strict` also fails on warnings. Builds reject source errors;
unknown layouts warn and retain the generic fallback for compatibility.

## Source model for integrations

`parseSlides(source)` returns the original `source`, `deckConfig`, `configSource`,
`slides` and `diagnostics`. Each slide has its resolved `meta`, `authoredMeta`
(the authored YAML fields before section inheritance), `id`, `content`, `regions`, directive `blocks`, and
`source`, `metaSource`, `bodySource` ranges. Ranges are half-open UTF-16 offsets
into the original string, including its whitespace and line endings.

Regions contain Markdown `content`. Explicit regions also carry their original
`raw` body and contiguous `source` range. The implicit body has `ranges` because
notes and slots may interrupt it. This is a source-preserving document model,
not a normalized Markdown serializer. Speaker notes come from `:::notes` body
blocks and are available as `slide.meta.notes`; they are not authored metadata.

`serializeDeck(deck)` returns the original source unchanged. Use
`replaceRegion(deck, slideId, regionName, markdown)` for targeted explicit-region
edits, or `applySourceEdits(source, edits)` for general changes. Edits specify
`start`, `end`, `text` and optionally `expected` text; overlaps and stale expected
text are rejected. Reparse the returned source after editing. Callers saving to
disk must also compare against the current file to detect external changes.

## Editing helpers

`src/core/editDeck.js` builds on the source model to change a deck without
disturbing anything else in the file. Every function takes the parsed deck,
never mutates it, and returns the new source (or `{ source, index }` for
structural changes); reparse the result before the next edit. Untouched bytes
stay identical, including comments, blank lines and the file's line endings.

| Function | Effect |
|---|---|
| `setRegion(deck, slideId, name, markdown)` | Replaces an explicit `:::slot` body, the implicit body (discontiguous ranges collapse into the first one), or appends a new slot |
| `removeRegion(deck, slideId, name)` | Removes a slot block |
| `setSlideMeta(deck, slideId, patch)` | Patches top-level keys of the slide's YAML; `undefined` deletes a key; works for `:::meta` and the legacy `---` form, inserting or removing the block as needed |
| `setSlideNotes(deck, slideId, markdown)` | Edits or removes a `:::notes` block, or appends one when absent |
| `setDeckConfig(deck, patch)` | Patches the frontmatter, inserting it when absent |
| `insertSlide(deck, index, markdown)` | Inserts a slide, keeping delimiters and blank lines tidy |
| `removeSlide(deck, slideId)` / `moveSlide(deck, slideId, toIndex)` | Structural changes that return the index to select next |
| `replaceSlideSource(deck, slideId, text)` | Replaces one slide's Markdown verbatim |

Metadata patches rewrite only the block of each changed key
(`patchYamlMapping` in `source.js`), so comments on other keys survive.
Comments inside an edited nested block such as `props:` are lost.

## Editor API

`mdeck edit` serves a small JSON API from the Vite dev server for the browser
editor. It binds to the loopback interface, refuses requests whose `Origin`
differs from its own host, and only ever writes the deck file and folders
under the deck's `extensions/` directory.

| Route | Purpose |
|---|---|
| `GET /__mdeck/deck` | `{ path, name, source, hash, registry, warnings }` |
| `POST /__mdeck/source` | `{ source, base }` writes when `base` equals the hash of the file on disk; otherwise `409 { source, hash }` |
| `GET /__mdeck/extension/:kind/:id` | The extension's manifest and text files |
| `PUT /__mdeck/extension/:kind/:id` | `{ files: { name: text \| null } }` writes into `extensions/<id>/` after validating the manifest against the files that will exist; built-ins are refused |
| `DELETE /__mdeck/extension/:kind/:id` | Removes a deck-local extension folder |

Two custom websocket events keep the editor in step with the disk:
`mdeck:deck-changed { hash }` when another program saved the deck, and
`mdeck:extensions-changed { file }` when an extension file changed.

The preview iframe runs the normal deck runtime with `?view=deck&editor=1`. The editor
posts `{ deckSource: { source, selection, config, overrides } }` to it;
`config` merges over the deck settings (for example to preview a palette) and
`overrides` carries unsaved theme and palette manifests. The runtime answers
with `{ deckEditorReady }`, `{ deckRendered: { slideCount, diagnostics, error } }`
and the usual `{ deckStateChanged }` messages.
