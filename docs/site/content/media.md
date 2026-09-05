# Add pictures and video

Keep your slide file and its pictures together in one folder. That makes the presentation easier to move and share later.

## Keep the files together

For example, your folder could look like this:

```text
my-talk/
  my-talk.md
  img/
    garden.jpg
  video/
    tour.mp4
```

`img` and `video` are ordinary folders you create. Their names are suggestions, not special mdeck requirements.

## Put a picture on a slide

Write a line like this where you want the picture:

```markdown
![A community garden in spring](./img/garden.jpg)
```

The words in square brackets describe the picture. The part in parentheses is its location, starting from the folder containing your slide file. `./` means “start in this folder.”

Use forward slashes in image paths, including on Windows. Simple filenames without spaces are easiest to work with.

For a picture beside text or a picture that fills the slide, use one of the [picture layouts](layouts.html#a-picture-beside-your-words).

## Show the whole picture

Picture layouts usually fill their available space, which can crop the edges. To keep the whole picture visible, use `fit: contain`:

```markdown
:::meta
layout: image-text
props:
  image: ./img/garden.jpg
  alt: "A community garden in spring"
  fit: contain
:::
# The whole garden
```

For a cropped picture, use `fit: cover`. You can add `position: "left center"` or `position: "70% 50%"` to choose which part stays in view.

## Add a video file

Paste this line into a normal slide, or into one side of a split slide:

```html
<videoplayer src="./video/tour.mp4" />
```

This is a special instruction to mdeck. You only need to change the filename. The player shows controls so you can choose when to play the video.

To start a video when its slide appears, add `play="auto"`:

```html
<videoplayer src="./video/tour.mp4" play="auto" />
```

Automatic playback is muted. Leaving the slide stops the local video; automatic videos also return to the beginning.

## Show an online video

Use `url` instead of `src` for a YouTube, Vimeo, or SwitchTube address:

```html
<videoplayer url="https://www.youtube.com/watch?v=YOUR_VIDEO_ID" />
```

Replace the example address with your video's address. Online videos need an internet connection and permission from the video service to appear in another page. Test them before your talk.

## If a picture does not appear

Check the spelling of the filename and folder, including capital letters. Then run:

```sh
mdeck check my-talk.md
```

mdeck reports local files it cannot find. For sharing, use a [built presentation](sharing.html), so the necessary files travel with it.
