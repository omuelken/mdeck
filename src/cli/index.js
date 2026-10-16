// The mdeck command: parses the command line, then hands it to the command's
// module in commands/, loaded only when that command runs.
import { readFileSync } from 'fs'
import { parseArgs } from './args.js'
import { err, tip } from './ui.js'
import { HELP, COMMAND_HELP } from './help.js'
import { commandContext } from './context.js'

// The module of each command; some share one.
const COMMANDS = {
  new: 'new', run: 'run', rehearse: 'run', edit: 'edit', design: 'design', themes: 'packages', palettes: 'packages',
  build: 'build', send: 'build', pdf: 'pdf', preview: 'preview',
  check: 'check', snapshot: 'snapshot', results: 'results', list: 'list', starter: 'starter', docs: 'docs', skill: 'skill', server: 'server',
}

// ── Argument parsing ──────────────────────────────────────────────────────────
const [command, ...argv] = process.argv.slice(2)

if (command === '--version' || command === '-v' || command === 'version') {
  console.log(JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version)
  process.exit(0)
}

if (!command || command === '--help' || command === '-h') {
  console.log(HELP)
  process.exit(0)
}

// Names from before 2.0. They stop with the new name instead of being ignored.
const RENAMED_COMMANDS = { dev: 'mdeck run', present: 'mdeck run', live: 'mdeck server', templates: 'mdeck list layouts', extensions: 'mdeck list' }
const RENAMED_OPTIONS = [
  ['run', '--host', '--network'],
  ['run', '--share', '--server'],
  ['build', '--share', 'mdeck build --reader (a folder) or mdeck send (one file)'],
  ['build', '--self-contained', '--single-file'],
  ['build', '-S', '--single-file'],
  ['build', '--inline-images', '--single-file'],
  ['build', '-I', '--single-file'],
  ['build', '--presenter-launchers', '--launchers'],
  ['build', '--with-notes', 'mdeck send --notes'],
  ['build', '--pdf', 'mdeck pdf'],
  ['build', '--no-pdf', 'mdeck send --no-pdf'],
  ['build', '--no-ink', '--no-drawings'],
  ['pdf', '--no-ink', '--no-drawings'],
  ['send', '--no-ink', '--no-drawings'],
]
for (const [name, was, now] of RENAMED_OPTIONS) {
  if (command === name && argv.some(arg => arg === was || arg.startsWith(was + '='))) { err(`${was} is now ${now}.`); process.exit(1) }
}

if (argv.includes('--help') || argv.includes('-h')) { console.log(COMMAND_HELP[command] ? `${COMMAND_HELP[command]}\n` : HELP); process.exit(0) }

if (!Object.hasOwn(COMMANDS, command)) {
  err(`Unknown command: "${command}"`)
  if (Object.hasOwn(RENAMED_COMMANDS, command)) tip(`mdeck ${command} is now ${RENAMED_COMMANDS[command]}.`)
  tip('Run mdeck --help for usage.\n')
  process.exit(1)
}
let parsed
try {
  parsed = parseArgs(command, argv)
  if (['run', 'rehearse', 'server'].includes(command) && Object.hasOwn(process.env, 'MDECK_LIVE_KEY')) throw new Error('MDECK_LIVE_KEY is now MDECK_SERVER_KEY. Rename the environment variable before starting mdeck.')
} catch (error) {
  err(error.message)
  if (Object.hasOwn(RENAMED_COMMANDS, command)) tip(`mdeck ${command} is now ${RENAMED_COMMANDS[command]}.`)
  process.exit(1)
}

const { default: start } = await import(`./commands/${COMMANDS[command]}.js`)
await start(commandContext(command, parsed))
