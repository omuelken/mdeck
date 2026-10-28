// mdeck publish: the deck as one reader file, uploaded to your mdeck server.
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { basename, resolve } from 'path'
import { DECK_NAME_RE } from '../../live/decks.js'
import { validateServerOrigin } from '../args.js'
import { parseSlides } from '../../core/parseSlides.js'
import buildDeck from './build.js'
import { c, ok, err, tip } from '../ui.js'

const warn = message => console.log(`  ${c.yellow}!${c.reset}  ${message}`)

// "Übung 1.md" becomes ubung-1.
const nameFrom = file => basename(file).replace(/\.md$/i, '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63)

const ago = iso => {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000))
  return minutes < 90 ? `${minutes} min ago` : minutes < 2880 ? `${Math.round(minutes / 60)} h ago` : `${Math.round(minutes / 1440)} days ago`
}

// A problem to tell the person, with what to do about it; nothing else is caught.
class Refused extends Error {
  constructor(message, hint) { super(message); this.hint = hint }
}

const takenMessage = (name, address, { bytes, updated }) => new Refused(`${name} already exists on ${address} (published ${ago(updated)}, ${(bytes / 1048576).toFixed(1)} MB).`, 'Add --replace to overwrite it, or choose another name with --name.\n')

async function publish(context) {
  const { options, hasFlag, requireInput } = context
  const removing = hasFlag('--remove')
  // Taking a deck down needs no slides file when the name is given.
  const input = removing && options['--name'] ? null : requireInput('publish')
  const inDeck = input && existsSync(resolve(input)) ? parseSlides(readFileSync(resolve(input), 'utf8')).deckConfig?.server : null
  const address = (options['--server'] ?? (typeof inDeck === 'string' ? inDeck : null) ?? process.env.MDECK_SERVER ?? '').replace(/\/+$/, '') + '/'
  if (address === '/') throw new Refused('mdeck publish needs the server: --server https://slides.example.org, the deck\'s server setting or MDECK_SERVER')
  try { validateServerOrigin(address, 'The server') } catch (error) { throw new Refused(error.message) }
  const key = process.env.MDECK_SERVER_KEY
  if (!key) throw new Refused('mdeck publish needs the server\'s key in MDECK_SERVER_KEY.')
  const name = options['--name'] ?? nameFrom(input)
  if (!DECK_NAME_RE.test(name)) throw new Refused(`"${name}" cannot be a deck name: use lowercase letters, digits and hyphens (--name)`)
  const { protocol, hostname } = new URL(address)
  if (protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(hostname)) warn(`${address} is not https: the key travels unencrypted.`)

  const target = `${address}decks/${name}`
  const headers = { Authorization: `Bearer ${key}` }
  // A redirect would turn the upload into something else, and may carry the key along.
  const call = async (url, init, timeout) => {
    try { return await fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(timeout) }) } catch (error) { throw new Refused(`Could not reach ${address}: ${error.cause?.message ?? error.message}`) }
  }
  const explain = async response => { try { return (await response.json()).error } catch { return `HTTP ${response.status}` } }
  const hostHint = status => status === 404 ? 'Start the server with  mdeck server --decks <folder>  to accept decks, and with its key.\n' : undefined

  if (removing) {
    const response = await call(target, { method: 'DELETE', headers }, 15000)
    if (!response.ok) throw new Refused(`The server did not remove it: ${await explain(response)}`, hostHint(response.status))
    ok(`Removed: ${c.cyan}${address}d/${name}${c.reset}\n`)
    return
  }

  // Ask before building: a taken name should not cost a build.
  if (!hasFlag('--replace')) {
    const response = await call(`${address}decks`, { headers }, 15000)
    if (response.ok) {
      const taken = (await response.json().catch(() => ({}))).decks?.find(deck => deck.name === name)
      if (taken) throw takenMessage(name, address, taken)
    } else throw new Refused(`The server refused it: ${await explain(response)}`, hostHint(response.status))
  }

  // The reader build without notes, in one file: the same as mdeck send, minus the PDF.
  const dir = mkdtempSync(resolve(tmpdir(), 'mdeck-publish-'))
  // The build may end the process itself when the deck has problems.
  process.once('exit', () => rmSync(dir, { recursive: true, force: true }))
  const file = resolve(dir, `${name}.html`)
  await buildDeck({ ...context, command: 'publish', outputOption: () => file })
  const response = await call(target, { method: 'PUT', headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8', ...(hasFlag('--replace') ? { 'X-Mdeck-Replace': '1' } : {}) }, body: readFileSync(file) }, 120000)
  if (response.status === 409) throw takenMessage(name, address, await response.json().catch(() => ({ bytes: 0, updated: new Date().toISOString() })))
  if (!response.ok) throw new Refused(`The server refused it: ${await explain(response)}`, hostHint(response.status))
  ok(`${(await response.json()).replaced ? 'Replaced' : 'Published'}: ${c.cyan}${address}d/${name}${c.reset}`)
  tip('Anyone with this link can open the deck. mdeck publish --replace updates it, --remove takes it down.\n')
}

export default async function publishDeck(context) {
  try { await publish(context) } catch (error) {
    err(error.message)
    if (error.hint) tip(error.hint)
    process.exit(1)
  }
}
