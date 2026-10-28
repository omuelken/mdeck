// mdeck publish: the deck as one reader file, uploaded to your mdeck server.
import { mkdtempSync, readFileSync } from 'fs'
import { rm } from 'fs/promises'
import { tmpdir } from 'os'
import { basename, resolve } from 'path'
import { DECK_NAME_RE } from '../../live/decks.js'
import { validateServerOrigin } from '../args.js'
import { parseSlides } from '../../core/parseSlides.js'
import buildDeck from './build.js'
import { c, ok, err, tip } from '../ui.js'

const nameFrom = file => basename(file).replace(/\.md$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63)

const ago = iso => {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000))
  return minutes < 90 ? `${minutes} min ago` : minutes < 2880 ? `${Math.round(minutes / 60)} h ago` : `${Math.round(minutes / 1440)} days ago`
}

export default async function publishDeck(context) {
  const { options, hasFlag, requireInput } = context
  const input = requireInput('publish')
  const inDeck = parseSlides(readFileSync(resolve(input), 'utf8')).deckConfig?.server
  const address = (options['--server'] ?? (typeof inDeck === 'string' ? inDeck : null) ?? process.env.MDECK_SERVER ?? '').replace(/\/+$/, '') + '/'
  if (address === '/') { err('mdeck publish needs the server: --server https://slides.example.org, the deck\'s server setting or MDECK_SERVER'); process.exit(1) }
  try { validateServerOrigin(address, 'The server') } catch (error) { err(error.message); process.exit(1) }
  const key = process.env.MDECK_SERVER_KEY
  if (!key) { err('mdeck publish needs the server\'s key in MDECK_SERVER_KEY.'); process.exit(1) }
  const name = options['--name'] ?? nameFrom(input)
  if (!DECK_NAME_RE.test(name)) { err(`"${name}" cannot be a deck name: use lowercase letters, digits and hyphens (--name)`); process.exit(1) }
  const target = `${address}decks/${name}`
  const headers = { Authorization: `Bearer ${key}` }
  const explain = async response => { try { return (await response.json()).error } catch { return `HTTP ${response.status}` } }

  try {
    if (hasFlag('--remove')) {
      const response = await fetch(target, { method: 'DELETE', headers, signal: AbortSignal.timeout(15000) })
      if (!response.ok) { err(`The server did not remove it: ${await explain(response)}`); process.exit(1) }
      ok(`Removed: ${c.cyan}${address}d/${name}${c.reset}\n`)
      return
    }
    // The reader build without notes, in one file: the same as mdeck send, minus the PDF.
    const dir = mkdtempSync(resolve(tmpdir(), 'mdeck-publish-'))
    const file = resolve(dir, `${name}.html`)
    try {
      await buildDeck({ ...context, command: 'publish', outputOption: () => file })
      const response = await fetch(target, { method: 'PUT', headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8', ...(hasFlag('--replace') ? { 'X-Mdeck-Replace': '1' } : {}) }, body: readFileSync(file), signal: AbortSignal.timeout(120000) })
      if (response.status === 409) {
        const { bytes, updated } = await response.json()
        err(`${name} already exists on ${address} (published ${ago(updated)}, ${(bytes / 1048576).toFixed(1)} MB).`)
        tip('Add --replace to overwrite it, or choose another name with --name.\n')
        process.exit(1)
      }
      if (!response.ok) { err(`The server refused it: ${await explain(response)}`); if (response.status === 404) tip('Start the server with  mdeck server --decks <folder>  to accept decks.'); process.exit(1) }
      ok(`${(await response.json()).replaced ? 'Replaced' : 'Published'}: ${c.cyan}${address}d/${name}${c.reset}`)
      tip('Anyone with this link can open the deck. mdeck publish --replace updates it, --remove takes it down.\n')
    } finally { await rm(dir, { recursive: true, force: true }) }
  } catch (error) {
    err(`Could not reach ${address}: ${error.message}`); process.exit(1)
  }
}
