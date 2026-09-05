# User-created slide templates

Templates define slide structure; themes supply typography and colors. Every
built-in layout and every deck-local template uses the same registry, manifest,
property resolver, and slide frame. A local template requires no framework edit.

```text
my-talk/
  slides.md
  templates/
    comparison/
      template.json
      layout.jsx
      styles.css       optional
      starter.md       optional
```

The folder name is the `layout:` value. Names must be lowercase letters, digits
and hyphens, beginning with a letter. Local templates cannot shadow built-ins.
Manifests are checked when loading, building, listing or validating a deck.
The dev server reloads when template files are changed, added or removed.

## Manifest

```json
{
  "name": "comparison",
  "title": "Side-by-side comparison",
  "regions": {
    "body": { "description": "Shared heading" },
    "left": { "required": true },
    "right": { "required": true }
  },
  "properties": {
    "emphasis": {
      "type": "string",
      "enum": ["none", "left", "right"],
      "default": "none"
    }
  }
}
```

`regions` must include `body`, which contains unassigned slide Markdown.
Authors fill additional regions using `:::slot left`, etc. A region can declare
`required: true` and a human-readable `description`. Unknown region names and
missing required content are validation errors.

`properties` describes values under slide metadata `props:`. Supported types:
`string`, `number`, `integer`, `boolean`, `array`, `object`. The schema supports
`required`, `default`, `enum`, numeric `minimum`/`maximum`, and array `items`,
`minItems`/`maxItems`. This is a small schema subset, not full JSON Schema.
Defaults are copied for each slide. Unknown properties and invalid values are
errors. Built-ins also accept their legacy top-level properties such as `image:`.

An optional `frame` selects `standard` (default), `title`, `chapter`, or `none`.
The last omits header/footer chrome; it still retains the slide container,
footnotes, ID, and navigation behavior.

## Renderer

`layout.jsx` default-exports a Preact component. It renders the slide body:

```jsx
import { h } from 'preact'
import { MarkdownRegion } from 'mdeck/template-api'

export default function Comparison({ regions, props }) {
  return <div class="slide-body">
    <MarkdownRegion region={regions.body} />
    <div class="comparison-options">
      <MarkdownRegion region={regions.left} />
      <MarkdownRegion region={regions.right}
        class={props.emphasis === 'right' ? 'is-emphasized' : ''} />
    </div>
  </div>
}
```

The component receives `regions`, resolved typed `props`, slide `meta`, `id`,
default-body `content`, `deckConfig`, `index`, `total`, and `manifest`.
Use `preact/hooks` for interactive templates. `MarkdownRegion` renders Markdown
and hydrates both built-in and deck-local components. It exposes a `data-region`
attribute for integrations. Footnotes are numbered across all regions and placed
in the shared frame.

The framework wraps the result in `SlideFrame`; do not add a second `<section>`
or frame in your renderer. `SlideFrame`, `MarkdownRegion`, and `HtmlContent` are
also exported from `mdeck/template-api` for integrations. The API import resolves
through mdeck's build plugin, including when the deck is outside the framework.

Keep CSS scoped to `.slide--comparison` and use theme variables:

```css
.slide--comparison .comparison-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
}
.slide--comparison .is-emphasized { color: var(--accent); }
```

JSX imports of assets and dependencies follow the same build rules as deck-local
components. Template CSS is included in both bundle and self-contained builds.
Local paths in Markdown images, media `src`, and `image:`/`props.image` are handled
by asset packaging. For other custom asset properties, import assets in JSX so
Vite can track them; arbitrary string properties are not treated as file paths.
Renderers must consume their declared regions; the framework validates the
manifest and authored values, but cannot prove what arbitrary JSX renders.

## Starters and discovery

`starter.md` is an editable slide preset. It should contain explicit `:::meta`
and placeholder region content, without a leading slide separator. `mdeck new`
lists built-in and local starters found beside the requested output deck.

```sh
mdeck templates slides.md
mdeck templates slides.md --json
mdeck templates slides.md --starter comparison
mdeck check slides.md --strict
```

The JSON listing is the serializable manifest registry, suitable for completion,
template galleries, or future editor inspectors. Listing and validation do not
execute template JSX. Packages and a visual editor are not implemented here.

See the runnable [custom template example](../../examples/custom-templates/slides.md):

```sh
mdeck dev examples/custom-templates/slides.md
mdeck build examples/custom-templates/slides.md
```
