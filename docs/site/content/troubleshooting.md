# When something goes wrong

Most problems come from a filename, a small settings mistake, or a preview that is no longer running. Start with the message you see below.

## The command is not recognized

If the terminal cannot find `mdeck`, open the mdeck project folder and run `npm link`. Close and reopen the terminal if needed, then try `mdeck --help`.

If it cannot find `npm` or `node`, Node.js needs to be installed or made available in your terminal first. Ask the person who manages your computer if you do not normally install software yourself.

You can still run the checkout directly from its project folder with `node bin/mdeck.js --help`. This runs the same command.

## The slide file cannot be found

Check that the terminal is open in the folder containing your talk. Look at the filename carefully: a plain-text editor may have saved `my-talk.md.txt` instead of `my-talk.md`.

For a file in another folder, give its path:

```sh
mdeck dev "talks/my garden talk.md"
```

## The preview does not update

Save the slide file, and check that the terminal running `mdeck dev` is still open. Make sure you are viewing the browser address printed by that command.

If you changed the file's name or moved it, stop the old preview with `Ctrl+C` and start it with the new path.

## It says the port is in use

This is usually harmless. Another local preview is using that address, so mdeck chooses the next available port. Open the address shown in the terminal, for example `http://localhost:5174/`.

“Re-optimizing dependencies” is also a normal development message after mdeck's setup changes. You do not need to do anything.

## It mentions files in the public directory

This warning can appear for deck-local template files in the current slide development server. It comes from how that server serves the presentation folder. If the slides render, you do not need to rewrite the paths suggested in the warning.

It is a known slide-preview configuration issue; the documentation server is separate. If a template fails to render, check for a more specific error below the warning and run `mdeck check my-talk.md`.

## A picture is missing

Check its path relative to the slide file, including capital letters. For `./img/garden.jpg`, there must be an `img` folder beside the slide file with `garden.jpg` inside it.

Run `mdeck check my-talk.md` for a list of missing local assets. If you are opening a built presentation, keep the whole output folder together.

## There is a settings error

A message such as `my-talk.md:12:1` points to line 12, column 1 of your file. Look there for a missing quote, an incorrect setting name, or inconsistent spaces.

Use spaces rather than tabs. Quote text with punctuation, such as `title: "Plans: a fresh start"`.

For new slides, a settings block should begin with `:::meta` and end with `:::`. Content goes underneath it. A notes or slot block also needs its own closing `:::`.

## Text is missing or does not fit

A slide has a fixed amount of space. Split a long explanation over two slides, shorten a paragraph, or try a simpler layout. The current checker does not automatically detect visual overflow.

If you see an “unknown region” error, check that the layout supports the named area you used. For example, `left` and `right` work with `split`, but not with `title`.

## The colors change back

Appearance changes in the presenter view are temporary. Save the theme and palette you want in your slide file's settings. See [Change the look](appearance.html).

## A video or live example does not work offline

Online videos and live Python need a network connection. A self-contained build embeds local media; it does not download an entire external service. Use a local video file if you need to play it offline.

## Still stuck?

Keep the exact error message and a small copy of the slide that causes it. Include the command you ran and whether the problem happens in the live preview or a built file. Those details make it much easier for someone to help.
