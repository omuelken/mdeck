# Use a reusable slide design

A reusable slide design is a layout someone has made for a particular purpose: a comparison, a timeline, or a team introduction. In mdeck, these are called **templates**.

You do not have to create a template to use one. Someone comfortable with coding can make it once, and other people can fill it with their own words.

<!-- preview -->

## Keep the design with the talk

If someone gives you a presentation folder with an `extensions` folder inside, keep that folder beside the slide file. mdeck finds those designs automatically.

```text
my-talk/
  my-talk.md
  extensions/
    comparison/
      …files supplied by the design's creator
```

Copy the whole design folder if you move it to a different presentation. You do not need to edit mdeck itself. The same folder can also hold a theme or a set of colors made for your team; `mdeck extensions my-talk.md` lists everything it found.

Older presentations may have a `templates` folder instead. It still works, and `mdeck check` explains how to move it.

## See which designs are available

```sh
mdeck templates my-talk.md
```

The list includes the usual layouts and any extra ones saved beside your talk.

## Start from an example

Ask mdeck to show the starting text for a design:

```sh
mdeck templates my-talk.md --starter comparison
```

Copy the text it prints into your slide file. Put `---` on its own line before it if you are adding it after an existing slide.

Replace the example words, leaving the named areas and settings in place. If you use `mdeck new` to make a file beside an existing `extensions` folder, its wizard also offers those designs.

## Understand the comparison example

The example shipped with this project contains two slides. The first uses an extra design called `comparison`. The second uses the usual `split` layout with a list that appears one point at a time.

Open it from the project folder:

```sh
mdeck dev examples/custom-templates/slides.md
```

The comparison slide has settings like these:

```yaml
layout: comparison
props:
  ratio: [2, 3]
  emphasis: right
```

`props` groups this design's options. The ratio gives a little more room to the right side. Changing `emphasis` to `left` moves the highlighted border to the left side. Use `none` for no highlighted side.

The `:::slot left` and `:::slot right` blocks hold the words for the two sides. “Slot” simply means a named area that the design knows how to arrange.

## Check your changes

```sh
mdeck check my-talk.md
```

If a design requires a particular area or setting, mdeck tells you when it is missing. The creator of each design chooses its available settings, so one template's options may not work in another.

Want to make a design yourself? The [advanced template guide](custom-templates.html) explains the coding involved.
