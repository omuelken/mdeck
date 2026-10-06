// A theme's web fonts, embedded in a single-file build (mdeck send, --single-file,
// and the page mdeck pdf prints), so a file opened offline and its PDF look
// like the slides on the presenter's screen instead of falling back to system
// fonts.
//
// The theme's font stylesheets (Google Fonts and the like) are fetched once,
// limited to the Latin character sets, and every font file becomes a data URI.
// Fetched files are kept in a cache, so later builds need no network. Without
// network and cache the build goes on with the fallback fonts and says so.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// A current browser gets WOFF2, the smallest format.
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
// The character sets slides in Western languages need; Google Fonts names
// each block of a stylesheet after its set.
const SUBSETS = new Set(['latin', 'latin-ext'])
const FONT_TYPES = { woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf' }

export const fontCacheDir = () => process.env.MDECK_CACHE_DIR
  ? join(process.env.MDECK_CACHE_DIR, 'fonts')
  : join(process.env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'mdeck', 'fonts')

const key = text => createHash('sha256').update(text).digest('hex').slice(0, 32)

async function cached(url, { fetch: get, cacheDir, binary, timeoutMs }) {
  const file = join(cacheDir, key(url) + (binary ? '.bin' : '.css'))
  if (existsSync(file)) return binary ? readFileSync(file) : readFileSync(file, 'utf8')
  const response = await get(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(timeoutMs) })
  if (!response.ok) throw new Error(`${url} answered ${response.status}`)
  const body = binary ? Buffer.from(await response.arrayBuffer()) : await response.text()
  mkdirSync(cacheDir, { recursive: true })
  writeFileSync(file, body)
  return body
}

// The @font-face blocks of a stylesheet, without the character sets that
// slides rarely need (Cyrillic, Greek, Vietnamese …). A variable font is
// listed once per weight with the same file; those become one face with a
// weight range, so the file is embedded once.
export function latinFaces(css) {
  const blocks = [...css.matchAll(/(?:\/\*\s*([\w-]+)\s*\*\/\s*)?(@font-face\s*\{[^}]*\})/g)]
  const faces = blocks.filter(([, subset]) => !subset || SUBSETS.has(subset)).map(([, , face]) => face)
  const groups = new Map()
  for (const face of faces) {
    const src = face.match(/src:\s*([^;]+);/)?.[1]
    const style = face.match(/font-style:\s*([^;]+);/)?.[1] ?? 'normal'
    const weights = (face.match(/font-weight:\s*([^;]+);/)?.[1] ?? '400').trim().split(/\s+/).map(Number)
    const id = `${src}|${style}`
    if (!src || weights.some(Number.isNaN)) { groups.set(face, { face }); continue }
    const group = groups.get(id)
    if (!group) groups.set(id, { face, min: Math.min(...weights), max: Math.max(...weights) })
    else { group.min = Math.min(group.min, ...weights); group.max = Math.max(group.max, ...weights) }
  }
  return [...groups.values()].map(({ face, min, max }) => min == null ? face
    : face.replace(/font-weight:\s*[^;]+;/, `font-weight: ${min === max ? min : `${min} ${max}`};`))
}

/**
 * CSS with the fonts of these stylesheet URLs embedded, and warnings for
 * whatever could not be fetched.
 */
export async function embedFonts(urls = [], { fetch: get = fetch, cacheDir = fontCacheDir(), timeoutMs = 15000 } = {}) {
  const faces = [], warnings = []
  for (const url of urls) {
    try {
      const css = await cached(url, { fetch: get, cacheDir, binary: false, timeoutMs })
      for (const face of latinFaces(css)) {
        let embedded = face
        for (const [match, fontUrl] of face.matchAll(/url\((?:'|")?([^'")]+)(?:'|")?\)/g)) {
          const type = FONT_TYPES[fontUrl.split(/[?#]/)[0].split('.').pop()] ?? 'font/woff2'
          const data = await cached(new URL(fontUrl, url).href, { fetch: get, cacheDir, binary: true, timeoutMs })
          embedded = embedded.replace(match, `url(data:${type};base64,${data.toString('base64')})`)
        }
        faces.push(embedded)
      }
    } catch (error) {
      warnings.push(`The font ${url} could not be embedded (${error.cause?.code ?? error.message}); the file uses the fallback fonts.`)
    }
  }
  return { css: faces.join('\n'), warnings }
}
