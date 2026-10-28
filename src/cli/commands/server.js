// mdeck server: rooms for polls and for presenting through it.
import { startLiveServer } from '../../live/server.js'
import { checkServer } from '../../live/check.js'
import { weakKeyReason } from '../../live/rooms.js'
import { validateServerOrigin } from '../args.js'
import { c, ok, err, tip } from '../ui.js'

const warn = msg => console.log(`  ${c.yellow}!${c.reset}  ${msg}`)

// mdeck server --check [address]: tests a running server from here.
async function check(options) {
  const address = options['--check'] ?? process.env.MDECK_SERVER
  if (!address) { err('mdeck server --check needs the server\'s address: mdeck server --check https://slides.example.org (or set MDECK_SERVER)'); process.exit(1) }
  try { validateServerOrigin(address, 'The address') } catch (error) { err(error.message); process.exit(1) }
  const key = process.env.MDECK_SERVER_KEY || null
  console.log(`\n  Checking ${c.cyan}${address}${c.reset}${key ? '' : ' (without a key: MDECK_SERVER_KEY is not set here)'}\n`)
  const results = await checkServer(address, { key })
  for (const { name, status, detail } of results) (status === 'ok' ? ok : status === 'warn' ? warn : err)(`${name}: ${detail}`)
  const failed = results.filter(result => result.status === 'fail').length
  console.log('')
  if (failed) process.exitCode = 1
}

export default async function startServer({ options, portOption }) {
  if (options['--check'] !== undefined) return check(options)
  const port = portOption() ?? 8787
  const host = options['--host'] === null ? '0.0.0.0' : options['--host'] ?? '127.0.0.1'
  const key = process.env.MDECK_SERVER_KEY || null
  try {
    const server = await startLiveServer({ port, host, key })
    ok(`Server: ${c.cyan}${server.url}${c.reset}`)
    const weak = key && weakKeyReason(key)
    if (weak) { warn(`MDECK_SERVER_KEY is easy to guess: ${weak}.`); tip('Anyone who guesses it can reset your rooms and use this server as a relay. Make a random one with  openssl rand -hex 24  and keep it: presenters need it too.') }
    tip(`Open ${server.url}/ for its status page; ${server.url}/health answers monitors.`)
    tip('Point decks at it with  server: https://your.host  behind a web server that passes WebSocket connections on,')
    tip('and test that from another computer with  mdeck server --check https://your.host')
    tip(key ? 'Presenters reset rooms after opening the deck once with ?serverkey=<MDECK_SERVER_KEY>, and mdeck run --server can present through it.' : 'Set MDECK_SERVER_KEY to let presenters reset rooms and to allow mdeck run --server.')
    tip('Rooms live in memory only. Press Ctrl+C to stop.\n')
    const stop = async () => { await server.close(); process.exit(0) }
    process.once('SIGINT', stop)
    process.once('SIGTERM', stop)
  } catch (error) { err(error.message); process.exitCode = 1 }
}
