# Change the look

A **theme** chooses the fonts and overall style. A **palette** chooses a set of colors. You can change either without rewriting your slides.

## Choose a theme

Put the theme name under `design` in the settings at the very top of your file:

```yaml
---
design: neue
palette: paper
---
```

If you already have a settings block there, change the existing lines rather than adding a second block.

| Name to use | What it looks like |
|---|---|
| `neue` | Clear, simple type and generous space |
| `aurora` | A modern look with geometric shapes and color accents |
| `duet` | Two accent colors for contrasting ideas |
| `editorial` | A book-like look with serif headings |
| `fhnw` | The FHNW visual identity |
| `terminal` | A dark look with lettering like a computer terminal |

## Choose colors

Set `palette` to one of these names:

| Light palettes | Dark palettes |
|---|---|
| `paper` — white and neutral | `dark-slate` — cool and restrained |
| `sage` — muted green | `dark-ember` — warm highlights |
| `mono` — black and white | `dark-neon` — vivid highlights |
| `terra` — warm earth colors | `dark-mono` — dark monochrome |

Leave out `palette` to use the theme's own colors.

## Pick your own accent color

The accent is the color used for highlights. You can set it directly:

```yaml
---
design: neue
palette: paper
accent: "#2455c7"
---
```

The value beginning with `#` is a color code. Many color pickers let you copy this value. Keep the quotation marks around it. Themes that use a second accent also accept `accent2`.

## Try a look before saving it

Open the presenter view:

```sh
mdeck present my-talk.md
```

Its appearance controls let you try themes and colors. These changes are a preview: they do not save back to your text file. Once you find a look you like, put its settings in the file and save.

## Add your name and organization

```yaml
---
design: neue
meta:
  title: "A place to grow"
  author: "Alex Morgan"
  organization: "The garden team"
  date: "12 June 2026"
---
```

The text on the title slide still comes from the heading you write on that slide. The settings above supply information for the slide's header and footer.

You can also add `logo: ./img/logo.png` inside the `meta` group.

## Control headers and page numbers

These settings go at the top level of the deck settings, alongside `design`:

| Setting | Choices | Usual behavior |
|---|---|---|
| `institution` | `title`, `all`, `none` | Organization appears on the title slide |
| `authorDate` | `title`, `all`, `none` | Author and date appear on the title slide |
| `pageNumbers` | `slides`, `all`, `none` | Numbers appear after the title slide |
| `sections` | `all`, `none` | Section labels appear when provided |

## Change the slide shape

The usual shape is widescreen, with a width of 1920 and height of 1080. For a classic 4:3 shape, set:

```yaml
width: 1920
height: 1440
```

Check your slides after changing their shape. A layout that fit before may need fewer words or a different picture crop.
