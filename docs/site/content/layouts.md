# Choose a slide layout

A layout arranges your words and pictures. Your assistant chooses one for each slide; this page shows what each looks like in the file, so you know what to ask for:

```prompt
Make slide 2 a title slide, and put the photo of the garden beside
the text on slide 5.
```

To change a layout by hand, copy one of the examples below and replace the example text with your own.

<!-- preview -->

## A title and subtitle

Use `title` at the beginning of a talk. The `#` line is the title; the `##` line is its subtitle.

```markdown
:::meta
layout: title
:::
# A small idea
## A clear presentation
```

## A normal content slide

Leave out the layout setting for a heading with ordinary content underneath:

```markdown
# What we learned

- Make room for questions.
- Use examples people recognize.
- End with a next step.
```

## A big statement or quote

Use `focus` for a short message. The optional `attribution` names the person who said it.

```markdown
:::meta
layout: focus
attribution: "Our team"
:::
# Good questions make better conversations.
```

## A new section

Use `chapter` between the main parts of a longer talk:

```markdown
:::meta
layout: chapter
number: 2
part: "What we learned"
:::
# Listen first

Three lessons from our conversations.
```

The `part` name also becomes the section label on following slides. Set `section:` on a later slide to change it.

## A picture beside your words

Use `image-text` and tell mdeck where the picture is saved:

```markdown
:::meta
layout: image-text
image: ./img/garden.jpg
alt: "A community garden in spring"
:::
# A place to grow

Our neighbors turned an empty space into a garden.
```

Replace the image path with your own. The [picture guide](pictures-and-video.html) explains how paths work.

## Two areas side by side

Use `split` and name the content for each side. A **slot** is simply a named area on the slide.

```markdown
:::meta
layout: split
props:
  ratio: [1, 2]
:::
# Two ways to begin

:::slot left
## Ask
What do people need?
:::

:::slot right
## Listen
Make space for their answers before suggesting a solution.
:::
```

`ratio: [1, 2]` makes the right side twice as wide as the left. Use `[1, 1]` for equal widths. The heading above the slots is shared by both sides.

Some older examples do not name the sides. In those slides, mdeck puts the first piece of content on the left and the rest on the right.

## A picture that fills the slide

Use `full-bleed-image` for a large photograph. `overlay: true` adds the theme's overlay treatment to help the title stand out.

```markdown
:::meta
layout: full-bleed-image
image: ./img/garden.jpg
overlay: true
:::
# Small beginnings
```

## More layouts

Your presentation folder can contain extra layouts made for your team or organization. Learn how to [use a reusable layout](reusable-layouts.html). If none of them fits, your assistant can make a new one for the talk, just by describing it.
