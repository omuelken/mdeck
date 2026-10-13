# Dataviews: ways to show data

A dataview shows the data of a `<data>` tag (see
[Data: tables and charts](authoring.md#data-tables-and-charts)). mdeck comes
with `table`, `bar`, `line`, `scatter`, `stat`, `heatmap` and `dumbbell`; a deck
can add its own, and an assistant can write one on request, as it writes
layouts. A dataview is an extension like a layout or a theme: a folder with an
`extension.toml` and the file that draws, beside the deck in `extensions/`
(any folder below it), installed for the user, or built in.

```text
extensions/
  meter/
    extension.toml
    view.jsx          # draws the data
    styles.css        # optional
```

## The manifest

```toml
schema = 1
kind = "dataview"
id = "meter"                    # the name <data show="meter"> uses
title = "Meter"
description = "Each row a bar from 0 to its goal."
size = "content"                # or "fixed" (default): a box of the tag's height
steps = ["rows"]                # how it can build up: rows, series

[needs]
numbers = 1                     # at least this many columns of numbers
# series = 2                    # at most this many value columns
# rows = 20                     # at most this many rows
# x = "number"                  # the label column holds numbers or dates

[options.goal]                  # <data show="meter" goal="50">
type = "number"                 # string, number, integer or boolean
default = 100
description = "The value of a full bar"
```

| Setting | Meaning |
|---|---|
| `size` | `fixed`: the dataview gets a box of the tag's `height` (520 slide pixels by default) and its width, as charts need; `content`: it is as tall as what it draws, as a table is |
| `steps` | The `steps` values it supports; `mdeck check` reports others |
| `needs` | What data it can show; `mdeck check` and the slide say what is missing |
| `options` | Its own attributes, typed like a layout's properties (`type`, `enum`, `default`, `minimum`, `maximum`, `description`). Attribute values are text: `number` and `integer` read them as numbers, `boolean` takes `true`, `false`, or the attribute alone. The attributes every dataview shares (`src`, `show`, `title`, `x`, `y`, `rows`, `sort`, `highlight`, `steps`, `unit`, `height`, `caption`) cannot be options |
| `files` | `view` (default `view.jsx`) and `styles` (default `styles.css`, or a list) |

Dataviews in a deck's `extensions/` folder replace built-in ones of the same
id for that deck. `mdeck list dataviews` lists them with their options.

## The view

`view.jsx` exports a Preact component. It is trusted code, like a layout:

```jsx
import { h } from 'preact'
import { stepOf, format, color } from 'mdeck/dataview'

export default function Meter({ data, options, width, height, font }) {
  return <div class="meter">{data.rows.map((row, i) => <div key={row.index} {...stepOf(data, i)}>
    <span>{row.label}: {format(data, row.values[0], 0)}</span>
    <div class="meter-track"><div style={{ width: `${row.values[0] / options.goal * 100}%`, background: color(0) }} /></div>
  </div>)}</div>
}
```

It receives:

| Prop | Meaning |
|---|---|
| `data.columns` | Every column of the table: `{ name, type: 'number' \| 'date' \| 'text', percent, decimals }` |
| `data.x` | The index of the column that names the rows |
| `data.series` | The value columns, in order: `{ name, column, index }` |
| `data.rows` | The rows shown, in order: `{ index, label, cells: [{ text, value }], values, highlight }`. `values` holds a number (or `null`) per series; `index` is the row's number in the file |
| `data.title`, `data.unit`, `data.steps`, `data.lang` | From the tag and the deck |
| `options` | Its options, typed, with their defaults |
| `width`, `height` | Its box in slide pixels (`height` for `size = "fixed"`) |
| `font` | The text size in its box, in slide pixels; labels look right at 0.8 of it |

The `<data>` tag draws the title, the caption, a table of the data for screen
readers, and a message in place of the dataview when the data cannot be shown,
so a dataview only draws the data.

### `mdeck/dataview`

| Export | Use |
|---|---|
| `color(index)` | The colour of series `index`: `var(--dataview-1)` … `var(--dataview-6)`: the palette's three accents, then mixes of them with the ink |
| `markColor(data, row, series)` | That colour, faded when other rows are highlighted |
| `format(data, value, series, { compact })` | A number as the deck's language writes it, with the column's decimals and `%` |
| `formatTick(data, value, step)` | An axis tick, with as many decimals as the step between ticks |
| `stepOf(data, row, series)` | The attributes that make a part appear with its row or series under `steps` (none otherwise). In one SVG drawing, parts with the same number appear together |
| `niceTicks(min, max, { count, zero })` | Round numbers for an axis: `{ min, max, ticks, step }` |
| `linear([d0, d1], [r0, r1])` | A linear scale |
| `bands(count, [r0, r1], { padding })` | Slots for bars: `{ start(i), center(i), size, slot }` |
| `barPath({ base, end, across, thickness, vertical, radius })` | A bar rounded at its data end, as an SVG path |
| `extent(data, { options, series, stacked })` | The lowest and highest value, or the `min` and `max` options |
| `textWidth(text, size)` | About how wide a label is, to leave room for it |
| `Legend` | A legend for two or more series (`<Legend data={data} marker="line" />`) |
| `useBox(ref)` | The size and text size of an element, in slide pixels |
| `t(key, vars)` | mdeck's own words in the deck's language |

### Drawing with the deck's look

- Draw with the palette, never fixed colours: `color(i)` for marks, `var(--ink)`,
  `var(--muted)` and `var(--rule)` for text and lines, `var(--bg)` for gaps and
  the ring around dots. The `.dataview` element sets `--dataview-grid` and
  `--dataview-axis` too. Light and dark then work by themselves.
- Text takes text colours, never a series' colour; a coloured mark beside it
  says which series it is.
- Label sparingly: the end of a line, the highlighted row, a short series.
- Show what `highlight` picks out (`row.highlight`), and build up with
  `stepOf` when the dataview lists `steps`.
- In PDFs, print and Read mode every step is shown; nothing needs to move.
- `.dataview svg text` is styled for axis labels; `.dataview-value` for values.
