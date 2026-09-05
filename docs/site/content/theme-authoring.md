# Create a theme or palette

This guide is for people comfortable with CSS. For the existing choices, see [Change the look](appearance.html).

## Theme structure

Copy a theme folder under the framework's `assets/themes/` directory. It contains `tokens.css`, `templates.css`, `meta.json`, and `index.js`.

- `tokens.css` defines colors, fonts, sizes, and spacing as CSS custom properties.
- `templates.css` styles the slide frame and layout classes.
- `meta.json` declares fonts, configurable parameters, and theme metadata.
- `index.js` exports those resources to the loader.

```js
import tokensCSS from './tokens.css?inline'
import templatesCSS from './templates.css?inline'
import themeMeta from './meta.json'

export { tokensCSS, templatesCSS, themeMeta }
```

Register the theme in `src/runtime/themeLoader.js`. To offer it in the new-deck wizard too, add its name to `THEMES` in `src/cli/index.js`. Unlike slide templates, themes are currently framework-level additions; there is no automatic deck-local theme discovery.

## Shared color tokens

| Token | Purpose |
|---|---|
| `--bg` | Slide background |
| `--surface` | Code and other raised surfaces |
| `--ink` | Main text |
| `--ink-soft` | Body text |
| `--muted` | Secondary labels |
| `--rule` | Borders |
| `--accent` | Main highlight |
| `--accent-2` | Secondary highlight |
| `--on-accent` | Text placed on an accent background |

Use these tokens rather than hardcoded colors in layout CSS. This allows palettes to repaint the theme. Check the contrast of small text and text placed on an accent background.

## Theme parameters

Parameters in `meta.json` connect author-facing settings to CSS tokens:

```json
{
  "name": "My Theme",
  "fonts": [],
  "params": {
    "primaryColor": { "token": "--accent", "default": "#2455c7" }
  }
}
```

Authors can set `params.primaryColor` in deck configuration. Values are applied in this order: theme defaults, palette, parameters, then the `accent` and `accent2` shorthands.

## Add a palette

Add a JSON file under the framework's `assets/palettes/` directory. Its filename becomes the palette name, with no manual registration:

```json
{
  "name": "Blue notebook",
  "tokens": {
    "--bg": "#ffffff",
    "--surface": "#eef2f7",
    "--ink": "#203148",
    "--ink-soft": "#34465c",
    "--muted": "#54647a",
    "--rule": "#dbe3ee",
    "--accent": "#2455c7",
    "--accent-2": "#17625c",
    "--on-accent": "#ffffff"
  }
}
```

Set `"dark": true` for a dark palette. The loader then applies dark syntax-highlighting colors and a logo inversion filter. Check the result with the actual logo; automatic inversion does not suit every image.

## Check every layout

Try title, chapter, focus, image-text, split, full-bleed-image, and ordinary content slides. Include long titles, lists, pictures, code, footnotes, and a dark palette. Check each aspect ratio you intend to support and the browser's print output.
