// mdeck docs: the guides, served or built.
import { ok, err, tip } from '../ui.js'

export default async function docs({ positionals, hasFlag, portOption }) {
  try {
    const options = { page: (positionals()[0] ?? 'index').replace(/\.html$/, ''), open: !hasFlag('--no-open'), port: portOption() ?? 4174 }
    const buildOnly = hasFlag('--build')
    const { pageFor } = await import('../../../docs/site/pages.js')
    if (!pageFor(options.page)) throw new Error(`No guide named "${options.page}". Try mdeck docs getting-started.`)
    if (buildOnly) {
      const { buildDocs } = await import('../../../docs/site/build.js')
      ok(`Documentation built: ${await buildDocs()}`)
    } else {
      tip('Preparing the guides and slide examples…')
      const { startDocs } = await import('../../../docs/site/server.js')
      const docs = await startDocs(options)
      ok(`Documentation: ${docs.url}`)
      tip('Press Ctrl+C to close the documentation server.')
      const stop = async () => { await docs.close(); process.exit(0) }
      process.once('SIGINT', stop)
      process.once('SIGTERM', stop)
    }
  } catch (error) { err(error.message); process.exitCode = 1 }
}
