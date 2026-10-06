# Use a reusable slide layout

A reusable layout is a slide arrangement someone has made for a particular purpose: a comparison, a timeline, or a team introduction.

You do not have to create a layout to use one. Someone, or an AI assistant, makes it once, and other people fill it with their own words. Your assistant sees every layout in the folder when it writes slides, so you can ask for one by name: “use the comparison layout for the before and after slide”.

<!-- preview -->

## Keep the layout with the talk

If someone gives you a presentation folder with an `extensions` folder inside, keep that folder beside the slide file. mdeck finds those layouts automatically.

```text
my-talk/
  my-talk.md
  extensions/
    comparison/
      …files supplied by the layout's creator
```

Copy the whole layout folder if you move it to a different presentation. You do not need to edit mdeck itself. The same folder can also hold a theme or a set of colors made for your team; `mdeck list my-talk.md` lists everything it found.

## See which layouts are available

```sh
mdeck list layouts my-talk.md
```

The list includes the usual layouts and any extra ones saved beside your talk.

## Start from an example

Ask mdeck to show the starting text for a layout:

```sh
mdeck starter comparison my-talk.md
```

Copy the text it prints into your slide file. Put `---` on its own line before it if you are adding it after an existing slide.

Replace the example words, leaving the named areas and settings in place. If you use `mdeck new` to make a file beside an existing `extensions` folder, its wizard also offers those layouts.

## Understand the comparison example

The example shipped with this project contains two slides. The first uses an extra layout called `comparison`. The second uses the usual `split` layout with a list that appears one point at a time.

Open it from the project folder:

```sh
mdeck run examples/custom-layouts/slides.md
```

The comparison slide has settings like these:

```yaml
layout: comparison
props:
  ratio: [2, 3]
  emphasis: right
```

`props` groups this layout's options. The ratio gives a little more room to the right side. Changing `emphasis` to `left` moves the highlighted border to the left side. Use `none` for no highlighted side.

The `:::slot left` and `:::slot right` blocks hold the words for the two sides. “Slot” simply means a named area that the layout knows how to arrange.

## Check your changes

```sh
mdeck check my-talk.md
```

If a layout requires a particular area or setting, mdeck tells you when it is missing. The creator of each layout chooses its available settings, so one layout's options may not work in another.

Want a new layout? Describe it to your assistant. The [advanced layout guide](custom-layouts.html) explains the code it writes.
