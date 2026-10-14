// mdeck server: rooms for polls and for presenting through it.
import { startLiveServer } from '../../live/server.js'
import { c, ok, err, tip } from '../ui.js'

export default async function startServer({ options, portOption }) {
  const port = portOption() ?? 8787
  const host = options['--host'] === null ? '0.0.0.0' : options['--host'] ?? '127.0.0.1'
  const key = process.env.MDECK_SERVER_KEY || null
  try {
    const server = await startLiveServer({ port, host, key })
    ok(`Server: ${c.cyan}${server.url}${c.reset}`)
    tip('Point decks at it with  server: https://your.host  behind a web server that passes WebSocket connections on.')
    tip(key ? 'Presenters reset rooms after opening the deck once with ?serverkey=<MDECK_SERVER_KEY>, and mdeck run --server can present through it.' : 'Set MDECK_SERVER_KEY to let presenters reset rooms and to allow mdeck run --server.')
    tip('Rooms live in memory only. Press Ctrl+C to stop.\n')
    const stop = async () => { await server.close(); process.exit(0) }
    process.once('SIGINT', stop)
    process.once('SIGTERM', stop)
  } catch (error) { err(error.message); process.exitCode = 1 }
}
