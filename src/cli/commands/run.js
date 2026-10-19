// mdeck run and mdeck rehearse: the launch page, the presenter view and its
// server, and with --server the relay that lets an iPad on any network in.
import { createServer } from 'vite'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { isAllowedRequest } from '../../build/editorPlugin.js'
import { createEditorServer } from '../../build/editorServer.js'
import { homePlugin } from '../../build/homePlugin.js'
import { livePlugin } from '../../live/server.js'
import { inkPlugin } from '../../build/inkPlugin.js'
import { resultsPlugin } from '../../build/resultsPlugin.js'
import { timingPlugin } from '../../build/timingPlugin.js'
import { createPairing, pairingPlugin, pairingStoreFor } from '../../build/pairing.js'
import { parseSlides } from '../../core/parseSlides.js'
import { validateServerOrigin } from '../args.js'
import { assertDrawings } from '../../build/drawings.js'
import { createRelayAccess } from '../../build/relayAccess.js'
import { sessionCode } from '../../live/code.js'
import { startTunnel, newTunnelId, loopbackUrl } from '../../build/tunnelClient.js'
import { baseConfig } from '../../build/config.js'
import { c, ok, err, tip } from '../ui.js'

// Whether a poll server answers at `address`, within a few seconds.
async function serverAnswers(address) {
  try {
    validateServerOrigin(address)
    const response = await fetch(new URL('info', address.replace(/\/*$/, '/')), { signal: AbortSignal.timeout(3000) })
    return response.ok
  } catch { return false }
}

// With --server the dev server serves under /t/<id>/, but its own addresses are
// mounted at /__mdeck/…: map the first onto the second before anything else.
function stripRelayBase(base) {
  return {
    name: 'mdeck-relay-base',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url.startsWith(`${base}__mdeck/`)) request.url = `/${request.url.slice(base.length)}`
        next()
      })
    },
  }
}

export default async function run({ command, hasFlag, portOption, serverOption, requireInput, onPort }) {
  const input = requireInput(command)
  const abs = resolve(input)
  try { assertDrawings(abs) } catch (error) { err(error.message); process.exit(1) }
  const port = portOption()
  const exposed = hasFlag('--network')
  const pairing = createPairing({ store: pairingStoreFor(abs) })

  // --server: the server relays an iPad's requests to this computer
  // (src/build/tunnelClient.js). The dev server then serves under /t/<id>/, the
  // address the iPad uses on the server, and its own addresses follow it. The
  // address is the flag's value, else the deck's server setting, else MDECK_SERVER.
  // With MDECK_SERVER and MDECK_SERVER_KEY set, the server is used without
  // --server when it answers; otherwise this computer presents alone.
  // --no-server keeps it out.
  let relay = null
  let serverFlag = serverOption()
  if (serverFlag === undefined && !hasFlag('--no-server') && process.env.MDECK_SERVER && process.env.MDECK_SERVER_KEY) {
    const address = process.env.MDECK_SERVER
    if (await serverAnswers(address)) {
      serverFlag = address
      tip(`Using your server from MDECK_SERVER (${address}); --no-server presents without it.`)
    } else tip(`Your server (MDECK_SERVER, ${address}) does not answer: presenting from this computer only.`)
  }
  if (serverFlag !== undefined) {
    const inDeck = parseSlides(readFileSync(abs, 'utf8')).deckConfig?.server
    const address = serverFlag ?? (typeof inDeck === 'string' ? inDeck : null) ?? process.env.MDECK_SERVER ?? null
    const key = process.env.MDECK_SERVER_KEY
    if (!address) { err('--server needs the address of your server.'); tip('Give it as  --server https://…, add  server: https://…  to the deck, or set MDECK_SERVER.'); process.exit(1) }
    try { validateServerOrigin(address) } catch (error) { err(error.message); process.exit(1) }
    if (!key) { err('--server needs the key of the server.'); tip('Start it as  MDECK_SERVER_KEY=<key> mdeck run <slides.md> --server'); process.exit(1) }
    const id = newTunnelId()
    relay = { server: address, key, id, base: `/t/${id}/`, url: `${address.replace(/\/+$/, '')}/t/${id}/`, state: 'connecting', reason: null }
  }
  const upstream = relay?.server ?? (() => {
    const address = parseSlides(readFileSync(abs, 'utf8')).deckConfig.server
    return typeof address === 'string' ? address : null
  })
  const base = baseConfig(abs, { server: relay?.server ?? null, proxyControls: !!process.env.MDECK_SERVER_KEY })
  const mountBase = relay?.base ?? '/'
  // The launch page starts these on first use, inside this process.
  const services = {
    async editor() {
      const editor = await createEditorServer(abs, { port: (port ?? 5173) + 10 })
      await editor.listen()
      return { url: new URL('editor.html', editor.resolvedUrls.local[0]).href }
    },
    async docs() {
      const { startDocs } = await import('../../../docs/site/server.js')
      return startDocs({ open: false })
    },
  }
  // The launch page drops answers and drawings through the files these write.
  const saving = request => isAllowedRequest(request) || pairing.allows(request)
  const ink = inkPlugin(abs, { authorize: saving }), results = resultsPlugin(abs, { authorize: saving })
  const server = await createServer({
    ...base,
    // A paired iPad may save ink and steer the rooms, like this computer.
    ...(relay ? { base: relay.base } : {}),
    plugins: [...(relay ? [stripRelayBase(relay.base)] : []), ...base.plugins, homePlugin(abs, { services, pairing, relay, server: relay?.server ?? null, resultsFile: results.api.file, inkFile: ink.api.file }), pairingPlugin(pairing), livePlugin({ pairing, upstream, key: process.env.MDECK_SERVER_KEY, session: () => sessionCode(parseSlides(readFileSync(abs, 'utf8')).deckConfig) }), ink, results, timingPlugin(abs, { authorize: saving })],
    publicDir: dirname(abs),
    server: {
      ...base.server,
      ...(port ? { port, strictPort: true } : {}),
      host: exposed ? true : base.server.host,
      open: hasFlag('--no-open') ? false : command === 'rehearse' ? `${mountBase}?view=presenter&rehearse=1` : `${mountBase}home.html`,
    },
  })
  await onPort(port, () => server.listen())
  const local = server.resolvedUrls.local[0]
  let tunnel = null
  if (relay) {
    let warned = false
    tunnel = startTunnel({
      // On the loopback address the dev server listens on: `localhost` may
      // resolve to the other one (IPv4 or IPv6), as in containers.
      server: relay.server, key: relay.key, id: relay.id, target: loopbackUrl(local, server.httpServer?.address()), base: relay.base,
      allow: createRelayAccess(server, abs),
      session: () => sessionCode(parseSlides(readFileSync(abs, 'utf8')).deckConfig),
      tokens: () => pairing.tokens(),
      log: message => { if (!message.startsWith('tunnel:')) tip(message) },
      onState(state, reason) {
        const before = relay.state
        relay.state = state
        relay.reason = reason ?? null
        if (state === 'up') { warned = false; ok(`Connected to ${c.cyan}${relay.server}${c.reset}`) }
        else if (state === 'refused') err(`Connecting to the server failed: ${reason}`)
        else if (state === 'down' && !warned) { warned = true; tip(before === 'up' ? 'Lost the connection to the server; reconnecting…' : `Cannot reach ${relay.server}; trying again until it answers.`) }
      },
    })
    pairing.onChange(() => tunnel.push())
    server.watcher.on('change', file => { if (resolve(file) === abs) tunnel.push() })
  }
  // Ctrl+C: strokes and answers still waiting to be written go to their files first.
  const stop = () => { tunnel?.stop(); ink.api.file.flushPending(); results.api.file.flushPending(); process.exit(0) }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  console.log()
  ok(`Launch page: ${c.cyan}${new URL('home.html', local).href}${c.reset}`)
  tip(`Presenter:   ${new URL('?view=presenter', local).href}`)
  tip(`Rehearse:    ${new URL('?view=presenter&rehearse=1', local).href}`)
  tip(`Audience:    ${new URL('?view=audience', local).href}`)
  // Phones in the room follow the talk (the reader view would show slides ahead).
  if (exposed) for (const url of server.resolvedUrls.network) tip(`Follow:      ${new URL('?view=follow', url).href}`)
  console.log()
  if (relay) tip(`iPad:        in the presenter view, click the connection icons and choose "iPad" or "Phone clicker"; it opens ${relay.url}`)
  ok(`Watching ${c.cyan}${abs}${c.reset}`)
  tip('Edit and save to reload.\n')
}
