# Change the look

A **theme** chooses the fonts and the style of the slides. A **palette** chooses the colours, in a light and a dark version. You can change either without rewriting your slides.

## Choose a theme

Put the theme name under `theme` in the settings at the very top of your file:

```yaml
---
theme: neue
---
```

If you already have a settings block there, change the existing lines rather than adding a second block.

| Name to use | What it looks like |
|---|---|
| `neue` | Swiss style: large type, clear lines, red on white |
| `aurora` | Northern lights: curtains of light, night-sky chapters and glass |
| `duet` | Two voices: two accent colours that take turns, slab headings |
| `editorial` | A magazine spread: serif headlines, drop caps, pull quotes |
| `fhnw` | The FHNW visual identity |
| `terminal` | A dark look with lettering like a computer terminal |

Each theme comes with colours that suit it, so you do not have to choose any.

## Choose colours

To use other colours, set `palette` to one of these:

| Name to use | Colours |
|---|---|
| `lagoon` | Teal on warm stone |
| `swiss` | White, black and signal red (neue's own) |
| `cobalt` | Strong ultramarine on white |
| `nordic` | Ice grey, deep navy and a cool steel blue |
| `graphite` | Black and white with a steel-blue accent |
| `terra` | Cream, deep navy and brick red |
| `forest` | Deep green with moss and ochre |
| `ember` | Sand and espresso with orange |
| `neon` | Violet and magenta, loud |

```yaml
---
theme: neue
palette: terra
---
```

The FHNW theme always uses the FHNW colours.

## Light or dark

Every palette has a light and a dark version. Choose dark for a dark lecture hall, light for a bright room:

```yaml
---
theme: neue
palette: terra
appearance: dark
---
```

Some slides use the other version on purpose: neue's statement slides are dark in a light talk and light in a dark one.

## Try a look before saving it

Open the launch page and choose **Presenter view**:

```sh
mdeck run my-talk.md
```

Its **Theme & Palette** controls let you try themes, palettes and light or dark. These changes are a preview: they do not save back to your text file. Once you find a look you like, put its settings in the file and save.

## Add your name and organization

```yaml
---
theme: neue
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

These settings go together under `show`, in the deck settings:

```yaml
show:
  organization: none
  numbers: all
```

| Setting | Choices | Usual behavior |
|---|---|---|
| `show.organization` | `title`, `all`, `none` | Organization appears on the title slide |
| `show.author` | `title`, `all`, `none` | Author and date appear on the title slide |
| `show.numbers` | `slides`, `all`, `none` | Numbers appear after the title slide |
| `show.sections` | `all`, `none` | Section labels appear when provided |

## Change the slide shape

The usual shape is widescreen, with a width of 1920 and height of 1080. For a classic 4:3 shape, set:

```yaml
width: 1920
height: 1440
```

Check your slides after changing their shape. A layout that fit before may need fewer words or a different picture crop.
