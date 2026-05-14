# Palettes

A palette is a set of six color values that map to the framework's core token vocabulary. Palettes are independent of any specific theme — any theme that respects the token contract will render correctly with any palette.

## Using a palette

Set `palette:` in the deck frontmatter:

```yaml
---
design: modern
palette: black-cherry
---
```

Palette values sit between the theme's base token defaults and any individual `params:` overrides, so per-deck color tweaks always win.

## The six tokens

| Token | Role |
|---|---|
| `--bg` | Slide background |
| `--ink` | Primary text |
| `--ink-soft` | Body text, descriptions |
| `--muted` | Small metadata — headers, footers, eyebrows |
| `--rule` | Borders and code block background |
| `--accent` | Highlights — bullet markers, `em` text, code border |

## Authoring a palette

Create a JSON file in this directory. The filename becomes the palette key.

```json
{
  "name": "Human-readable name",
  "tokens": {
    "--bg":       "#ffffff",
    "--ink":      "#0a0a0a",
    "--ink-soft": "#2a2a2a",
    "--muted":    "#6b6b6b",
    "--rule":     "#e5e5e5",
    "--accent":   "#2563eb"
  }
}
```

No registration step needed — any `.json` file placed here is automatically available.

## Design notes

- All six tokens should be set. Omitting a token leaves the theme default in place, which may look inconsistent.
- `--rule` doubles as the code block background tint. On dark palettes, keep it slightly lighter than `--bg`. On light palettes, keep it slightly darker.
- `--muted` is used for small uppercase text. On dark backgrounds it can be quite dark since it sits against `--bg`, not body text.
- Syntax highlighting colors are not palette-controlled. They are owned by the `CodeBlock` component (`components/code-block.css`) and stay consistent regardless of palette.
