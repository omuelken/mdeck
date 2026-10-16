import { c } from './ui.js'

// ── Help ──────────────────────────────────────────────────────────────────────
// `mdeck --help` lists the commands, one line each; `mdeck <command> --help`
// adds that command's options.
const cmd = (name, args, text) => `    ${c.green}mdeck ${name}${c.reset}${args ? ` ${args}` : ''}`.padEnd(48 + c.green.length + c.reset.length) + text

export const HELP = `
  ${c.bold}mdeck${c.reset} — markdown slide deck

  ${c.dim}Make and present${c.reset}
${cmd('new', '', 'Make a presentation with guided questions')}
${cmd('run', '[slides.md]', 'Launch page: present, edit, check and send')}
${cmd('rehearse', '[slides.md]', 'Present and save how long each slide takes')}
${cmd('edit', '[slides.md]', 'Edit slides in the browser')}
${cmd('design', '[folder]', 'Try and fine-tune themes and palettes')}
${cmd('themes', '<action>', 'Find, install, update or remove themes')}
${cmd('palettes', '<action>', 'The same for palettes')}

  ${c.dim}Hand out${c.reset}
${cmd('build', '[slides.md]', 'A folder to host')}
${cmd('send', '[slides.md]', 'One HTML file to send, without notes, with a PDF inside')}
${cmd('pdf', '[slides.md]', 'A PDF, one page per slide')}
${cmd('preview', '[folder]', 'Preview a built folder')}

  ${c.dim}Check and look up${c.reset}
${cmd('check', '[slides.md]', 'Find mistakes in the deck')}
${cmd('snapshot', '[slides.md]', 'Pictures of slides as PNG files')}
${cmd('results', '[slides.md]', 'The answers kept in the talk, as CSV or JSON')}
${cmd('list', '[kind]', 'Layouts, themes, palettes and dataviews')}
${cmd('starter', '<layout>', 'Starter Markdown for a layout')}
${cmd('docs', '[guide]', 'Open the guides')}
${cmd('skill', '', 'The slide-writing skill for AI assistants')}
${cmd('server', '', 'The server for polls and for presenting from an iPad')}
${cmd('migrate', '[slides.md]', 'Update a deck from before 2.0')}

  ${c.bold}slides.md${c.reset} defaults to the deck in this folder.
  ${c.green}mdeck <command> --help${c.reset} shows a command's options; ${c.green}mdeck --version${c.reset} which mdeck this is.
`

// Options shared by build, send and pdf.
const OUTPUT_OPTIONS = `
      --slide 3,5-7          only these slides, numbered as in the deck
      --no-drawings          leave out <slides>.drawings.json
      --no-results           leave out <slides>.results.json, the answers kept in the talk`

export const COMMAND_HELP = {
  run: `
    ${c.green}mdeck run${c.reset} [slides.md]
      --network              reach the slides from phones and tablets on this network
      --server [address]     present through your server, from an iPad on any network: the address,
                             the deck's server setting or MDECK_SERVER, with the key in MDECK_SERVER_KEY.
                             With both variables set, the server is used whenever it answers.
      --no-server            present from this computer only
      --no-open              do not open the browser
      --port <number>`,
  rehearse: `
    ${c.green}mdeck rehearse${c.reset} [slides.md]
      Like run, opening the presenter view rehearsing: each slide is timed, and the times can be
      saved into the deck (time: 1m30s). Takes run's options.`,
  edit: `
    ${c.green}mdeck edit${c.reset} [slides.md]
      Forms and a live preview; saves into the file.`,
  design: `
    ${c.green}mdeck design${c.reset} [folder | slides.md]
      Themes and palettes on a sample deck; saves into the folder's extensions/ (default: this folder).`,
  themes: `
    ${c.green}mdeck themes${c.reset} search [words] | install <theme> | remove <theme> | update [theme] | list
      install brings the theme's default palette along, for every deck;
      add slides.md or --local to install it for one deck only.
      --force                replace files you edited`,
  palettes: `
    ${c.green}mdeck palettes${c.reset} search [words] | install <palette> | remove <palette> | update [palette] | list
      Like themes.`,
  build: `
    ${c.green}mdeck build${c.reset} [slides.md] [-o dir/]
      --reader               the reader view: notes removed unless --notes, polls kept as a record
                             unless --no-polls
      --single-file          everything in one HTML file
      --launchers            add macOS/Linux and Windows launchers (folders only)${OUTPUT_OPTIONS}`,
  send: `
    ${c.green}mdeck send${c.reset} [slides.md] [-o talk.html]
      --notes                keep the speaker notes
      --no-polls             leave out the slides with polls and join codes
      --no-pdf               no PDF inside${OUTPUT_OPTIONS}`,
  pdf: `
    ${c.green}mdeck pdf${c.reset} [slides.md] [-o talk.pdf]
      --no-polls             leave out the slides with polls and join codes${OUTPUT_OPTIONS}`,
  preview: `
    ${c.green}mdeck preview${c.reset} [folder]
      Serves a built folder (default: dist).`,
  check: `
    ${c.green}mdeck check${c.reset} [slides.md]
      --strict               warnings count as errors
      --render               also show every slide in Chrome, all steps revealed: content that does
                             not fit, text cut off or hard to read, errors on the page`,
  snapshot: `
    ${c.green}mdeck snapshot${c.reset} [slides.md] [-o folder]
      Pictures go to .mdeck-snapshots/ unless -o names a folder.
      --slide <numbers>      only these slides: 3, 3,5 or 2-4
      --sheet                one picture of them all in a grid, each under its number and heading
      --dark | --light       in this appearance instead of the deck's own`,
  results: `
    ${c.green}mdeck results${c.reset} [slides.md] [-o answers.csv]
      Every answer as CSV: slide, room, kind, question, phone, time, answer.
      --summary              one row per option, number or word, with how many chose it
      --json                 each question with its summary and answers`,
  list: `
    ${c.green}mdeck list${c.reset} [layouts | themes | palettes | dataviews] [slides.md]
      Built-in, installed and deck-local extensions.
      --json`,
  starter: `
    ${c.green}mdeck starter${c.reset} <layout> [slides.md]
      Prints starter Markdown for the layout.`,
  docs: `
    ${c.green}mdeck docs${c.reset} [guide]
      --no-open   --port <number>
      --build                build the guides as a static site`,
  skill: `
    ${c.green}mdeck skill${c.reset} [--install <assistant>...] [--project] [--print]
      Assistants: claude, codex, cursor, copilot, gemini. --project installs into this folder,
      --print writes the skill to the terminal.`,
  server: `
    ${c.green}mdeck server${c.reset} [--port 8787] [--host [address]]
      Rooms for polls and for presenting through it; MDECK_SERVER_KEY is the presenter's key.
      Put a web server with HTTPS in front.`,
  migrate: `
    ${c.green}mdeck migrate${c.reset} [slides.md] [--dry-run]
      Updates settings, local layouts and drawings from before 2.0.`,
}
