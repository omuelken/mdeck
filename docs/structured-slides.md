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
are errors. Layout templates declare the other regions they accept.

Set `id:` for a durable link such as `#deployment-options`. Numeric links such
as `#3` remain supported. Without an authored ID, the parser assigns positional
IDs (`slide-1`, etc.); these are not stable across reordering.

Run `mdeck check talk.md` to validate YAML, dimensions, IDs, metadata and local
asset references. `--strict` also fails on warnings. Builds reject source errors;
unknown layouts warn and retain the generic fallback for compatibility.

## Source model for integrations

`parseSlides(source)` returns the original `source`, `deckConfig`, `configSource`,
`slides` and `diagnostics`. Each slide has its resolved `meta`, `authoredMeta`
(before section inheritance), `id`, `content`, `regions`, directive `blocks`, and
`source`, `metaSource`, `bodySource` ranges. Ranges are half-open UTF-16 offsets
into the original string, including its whitespace and line endings.

Regions contain Markdown `content`. Explicit regions also carry their original
`raw` body and contiguous `source` range. The implicit body has `ranges` because
notes and slots may interrupt it. This is a source-preserving document model,
not a normalized Markdown serializer.

`serializeDeck(deck)` returns the original source unchanged. Use
`replaceRegion(deck, slideId, regionName, markdown)` for targeted explicit-region
edits, or `applySourceEdits(source, edits)` for general changes. Edits specify
`start`, `end`, `text` and optionally `expected` text; overlaps and stale expected
text are rejected. Reparse the returned source after editing. Callers saving to
disk must also compare against the current file to detect external changes.
