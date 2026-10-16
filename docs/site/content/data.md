# Show data: tables and charts

Numbers on a slide can be a table, a bar chart, a line, a few large figures or a grid of colours. You write the numbers once; one word decides how they look, and the theme and palette decide the colours.

The easiest way is to ask your assistant:

```prompt
Turn the table on page 4 of results.pdf into a bar chart on its own
slide, and highlight this year.
```

## Write the numbers

Put the numbers between `<data>` and `</data>`, one row per line, the names of the columns first:

```markdown
<data show="bar" title="Students per year" highlight="2024">
year, students
2021, 120
2022, 148
2023, 161
2024, 203
</data>
```

This is CSV, the format spreadsheets save as. Separate the cells with commas, or with semicolons or tabs, as Excel often does. Write numbers without thousands separators (`1234`, not `1,234`), with a point or a comma before the decimals: `7.1` or `7,1`. In a file separated by commas, a number with a comma goes in double quotes: `"7,1"`. The slides show numbers as your deck's language writes them. A cell that contains a comma goes in double quotes: `"Smith, J."`.

Numbers you keep in a spreadsheet can stay there. Save it as CSV beside the slides and name the file:

```markdown
<data src="enrolment.csv" show="line" />
```

The file travels with the deck when you send it or make a PDF. While `mdeck run` shows the slides, saving the file shows the new numbers.

## Choose how it looks

`show` picks the way. Without it, the data is a table.

| `show` | Good for |
|---|---|
| `table` | Exact values, a few rows; numbers line up on the right |
| `bar` | Comparing amounts: years, groups, places. Long names turn the columns into bars |
| `line` | Change over time, one line per column of numbers |
| `scatter` | Two measurements against each other, such as rainfall and yield |
| `stat` | One to four numbers the slide is about, large |
| `heatmap` | A grid of numbers, such as results per group and week, or correlations |
| `dumbbell` | Two values per row: before and after, two groups |

Change `show="bar"` to `show="line"`, and the same numbers become a line.

## Pick out what matters

- `highlight="2024"` picks out a row: in a chart the other bars fade, in a table the row is marked.
- `y="wheat, barley"` shows only these columns; `x="region"` says which column names the rows.
- `sort="students desc"` puts the largest first; `rows="1-5"` keeps the first five (after sorting: the top five).
- `title="…"` writes a title above, `unit="t"` names the unit, `caption="Source: Federal Statistical Office"` writes a line below.
- `steps="rows"` shows one row per click, `steps="series"` one column of numbers per click, as points do with `:::steps`.

Each way of showing has a few settings of its own, written like the others; `mdeck list dataviews` lists them:

| `show` | Settings |
|---|---|
| `table` | `max-rows="8"` (the rest are counted below), `numbers="formatted"` (your language's separators instead of the numbers as written) |
| `bar` | `orientation="horizontal"` (or `vertical`), `stacked`, `values="all"` (or `highlight`, `none`), `min`, `max` |
| `line` | `points="all"` (or `none`), `fill` (for one line), `zero` (the axis starts at 0), `min`, `max` |
| `scatter` | `labels="site"` (a column that names the points), `zero` |
| `stat` | `change="change"` (a column with each figure's change) |
| `heatmap` | `values="false"` (no numbers in the cells), `scale="diverging"` (two colours either side of 0), `min`, `max` |
| `dumbbell` | `values="false"`, `zero` |

## Good charts on slides

- One message per chart: say it in the slide's heading ("Enrolment doubled since 2021"), and highlight the part that shows it.
- Two or three columns of numbers at most. The palette has three accent colours; after that, colours get hard to tell apart, and `mdeck check` says so.
- For a few exact numbers, a table or `stat` is often clearer than a chart.
- Hotspots (`hotspots: auto`) let you zoom into a chart while you talk.

If something is wrong, such as a misspelled column name or a cell that is not a number, the slide says what instead of the chart, and so does `mdeck check`.

Want a kind of chart mdeck does not have? Ask your assistant for a new *dataview*; it keeps it in the deck's `extensions` folder. See [Create a dataview](dataviews.html).
