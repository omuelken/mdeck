// mdeck design: the design page. With a deck, beside its editor; with a folder
// (or nothing), on the sample deck alone, saving into that folder's extensions/.
import { existsSync, statSync } from 'fs'
import { resolve, dirname } from 'path'
import { createEditorServer, createDesignServer } from '../../build/editorServer.js'
import { c, ok, err, tip } from '../ui.js'

export default async function design({ positionals, hasFlag, portOption, registryFor }) {
  const input = positionals()[0] ?? '.'
  if (!existsSync(input)) { err(`Not found: ${input}`); process.exit(1) }
  const withDeck = /\.md$/i.test(input) && !statSync(input).isDirectory()
  if (!withDeck && !statSync(input).isDirectory()) { err(`${input} is neither a folder nor a slides file`); process.exit(1) }
  const abs = resolve(input)
  registryFor(withDeck ? abs : resolve(abs, 'design.md'))
  const port = portOption()
  const options = { port: port ?? 5173, strictPort: !!port, open: hasFlag('--no-open') ? false : '/design.html' }
  const server = withDeck ? await createEditorServer(abs, options) : await createDesignServer(abs, options)
  await server.listen()
  console.log(`\n  ${c.green}➜${c.reset}  Design: ${c.cyan}${new URL('design.html', server.resolvedUrls.local[0]).href}${c.reset}\n`)
  ok(withDeck ? `Designing for ${c.cyan}${abs}${c.reset}` : `Designing in ${c.cyan}${abs}${c.reset}, on a sample deck`)
  tip(`Themes and palettes are saved as you type, in ${resolve(withDeck ? dirname(abs) : abs, 'extensions')}/. Decks in ${withDeck ? 'that' : 'this'} folder find them.\n`)
}
