import { readFileSync, existsSync, readdirSync } from 'fs'
import { resolve, dirname, basename, sep } from 'path'
import { parseSlides } from '../core/parseSlides.js'
import { validateDeck, formatDiagnostics } from '../core/validateDeck.js'
import { loadRegistry, extensionRoots, manifestsOf } from '../extensions/discover.js'
import { embedFonts } from './fonts.js'
import { stripNotes as stripNotesFrom } from '../core/editDeck.js'
import { componentFolders, componentFiles } from './components.js'
import { inkFileFor, normalizeInk, emptyInk } from '../core/ink.js'
import { isOwnWrite } from './ownWrites.js'
import { fileURLToPath } from 'node:url'
import { assertDrawings } from './drawings.js'
import { marked } from 'marked'

const VIRTUAL_ID = 'virtual:slides'
const RESOLVED_ID = '\0virtual:slides'

const COMPONENTS_ID = 'virtual:deck-components'
const RESOLVED_COMPONENTS_ID = '\0virtual:deck-components'
const EXTENSIONS_ID = 'virtual:mdeck-extensions'
const RESOLVED_EXTENSIONS_ID = '\0virtual:mdeck-extensions'
const INK_ID = 'virtual:deck-ink'
const RESOLVED_INK_ID = '\0virtual:deck-ink'

const MIME_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.m4v': 'video/x-m4v',
  '.webm': 'video/webm',
  '.ogv': 'video/ogg',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
}

function isLocalAssetRef(ref = '') {
  return ref
    && !/^([a-z]+:)?\/\//i.test(ref)
    && !ref.startsWith('data:')
    && !ref.startsWith('#')
}

function cleanAssetRef(ref) {
  const q = ref.indexOf('?')
  const h = ref.indexOf('#')
  const end = [q, h].filter(i => i !== -1).sort((a, b) => a - b)[0] ?? ref.length
  return ref.slice(0, end)
}

function toDataUrl(ref, baseDir) {
  if (!isLocalAssetRef(ref)) return null
  const cleanRef = cleanAssetRef(ref)
  const abs = resolve(baseDir, cleanRef)
  if (!existsSync(abs)) return null
  const ext = cleanRef.toLowerCase().slice(cleanRef.lastIndexOf('.'))
  const mime = MIME_BY_EXT[ext]
  if (!mime) return null
  const b64 = readFileSync(abs).toString('base64')
  return `data:${mime};base64,${b64}`
}

function inlineMarkdownImages(markdown, baseDir) {
  return markdown.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (m, alt, src, title) => {
    const dataUrl = toDataUrl(src, baseDir)
    if (!dataUrl) return m
    return `![${alt}](${dataUrl}${title ? ` "${title}"` : ''})`
  })
}

function inlineHtmlImgSources(markdown, baseDir) {
  return markdown.replace(/(<img\b[^>]*\bsrc=)(["'])([^"']+)(\2)/gi, (m, pre, quote, src, endQuote) => {
    const dataUrl = toDataUrl(src, baseDir)
    if (!dataUrl) return m
    return `${pre}${quote}${dataUrl}${endQuote}`
  })
}

function inlineHtmlMediaSources(markdown, baseDir) {
  return markdown.replace(/(<(?:video|audio|source|videoplayer)\b[^>]*\bsrc=)(["'])([^"']+)(\2)/gi, (m, pre, quote, src, endQuote) => {
    const dataUrl = toDataUrl(src, baseDir)
    if (!dataUrl) return m
    return `${pre}${quote}${dataUrl}${endQuote}`
  })
}

function inlineYamlImageFields(markdown, baseDir) {
  return markdown.replace(/^(\s*)(image|logo):\s*(["']?)([^"'\n]+)\3\s*$/gm, (m, indent, key, quote, value) => {
    const dataUrl = toDataUrl(value.trim(), baseDir)
    if (!dataUrl) return m
    const q = quote || '"'
    return `${indent}${key}: ${q}${dataUrl}${q}`
  })
}

export function collectLocalAssetRefs(markdown) {
  const refs = new Set()
  const add = ref => {
    const clean = cleanAssetRef(String(ref || '').trim())
    if (isLocalAssetRef(clean)) refs.add(clean)
  }

  const deck = parseSlides(markdown)
  add(deck.deckConfig.meta?.logo)
  for (const slide of deck.slides) {
    add(slide.meta.image)
    add(slide.meta.logo)
    add(slide.meta.props?.image)
    const bodies = [...Object.values(slide.regions).map(r => r.content), slide.meta.notes ?? '']
    for (const body of bodies) {
      if (typeof body !== 'string') continue
      marked.walkTokens(marked.lexer(body), token => {
        if (token.type === 'image') add(token.href)
        if (token.type === 'html') {
          for (const match of token.text.matchAll(/<(?:img|video|audio|source|videoplayer)\b[^>]*\bsrc=(["'])([^"']+)\1/gi)) add(match[2])
        }
      })
    }
  }

  return [...refs]
}

// Applies fn to the text outside fenced code blocks, so a path shown in a code
// example stays text instead of becoming an embedded file.
function outsideCodeFences(markdown, fn) {
  const lines = markdown.split('\n')
  let out = '', text = '', fence = null
  for (const [i, line] of lines.entries()) {
    const chunk = line + (i < lines.length - 1 ? '\n' : '')
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/)?.[1]
    if (fence) {
      out += chunk
      if (marker && marker[0] === fence[0] && marker.length >= fence.length && !line.trim().slice(marker.length).trim()) fence = null
    } else if (marker) {
      out += fn(text) + chunk
      text = ''
      fence = marker
    } else text += chunk
  }
  return out + fn(text)
}

export function maybeInlineAssets(markdown, abs, { inlineImages, inlineMedia }) {
  if (!inlineImages && !inlineMedia) return markdown
  const baseDir = dirname(abs)
  return outsideCodeFences(markdown, text => {
    let out = text
    if (inlineImages) out = inlineMarkdownImages(out, baseDir)
    if (inlineImages) out = inlineHtmlImgSources(out, baseDir)
    if (inlineImages) out = inlineYamlImageFields(out, baseDir)
    if (inlineMedia) out = inlineHtmlMediaSources(out, baseDir)
    return out
  })
}

// ─── Extension registry module ────────────────────────────────────────────
// Layouts, themes and palettes are discovered in Node and handed to the
// browser as one generated module. Layout code and styles are imported
// eagerly; theme stylesheets stay lazy so only the chosen theme is loaded.
// Layout JSX is trusted code, not sandboxed data.

export function generateExtensionsModule(registry) {
  const imports = []
  const layouts = Object.values(registry.layouts).map((t, i) => {
    imports.push(`import L${i} from ${JSON.stringify(t.files.layout)}`, ...t.files.styles.map(s => `import ${JSON.stringify(s)}`))
    return `${JSON.stringify(t.id)}: { manifest: ${JSON.stringify(t.manifest)}, render: L${i} }`
  })
  const themes = Object.values(registry.themes).map(t => {
    const loads = t.files.styles.map(s => `import(${JSON.stringify(s + '?inline')})`)
    return `${JSON.stringify(t.id)}: { manifest: ${JSON.stringify(t.manifest)}, load: () => Promise.all([${loads.join(', ')}]).then(mods => mods.map(m => m.default).join('\\n')) }`
  })
  const palettes = Object.values(registry.palettes).map(p => `${JSON.stringify(p.id)}: { manifest: ${JSON.stringify(p.manifest)} }`)
  return `${imports.join('\n')}\nexport const layouts = {\n${layouts.join(',\n')}\n}\nexport const themes = {\n${themes.join(',\n')}\n}\nexport const palettes = {\n${palettes.join(',\n')}\n}\n`
}

// `editor` keeps the page alive while `mdeck edit` rewrites the deck: deck
// changes only invalidate the module, validation errors are warnings, and
// extension changes are announced instead of forcing a reload.
export function slidesPlugin(slidesPath, { inlineImages = false, inlineMedia = false, editor = false, stripNotes = false, ink = true, embedFonts: embedThemeFonts = false } = {}) {
  const abs = resolve(slidesPath)
  const inkPath = inkFileFor(abs)
  const extensionDirs = extensionRoots(abs).map(root => root.dir)
  let componentDirs = componentFolders(abs).map(folder => folder.dir)
  const watchDirs = () => [...extensionDirs, ...componentDirs]
  const isWatched = file => watchDirs().some(dir => resolve(file).startsWith(dir + sep))
  // A changed `components:` list takes effect without restarting the server.
  const followComponentFolders = server => {
    const next = componentFolders(abs).map(folder => folder.dir)
    if (next.join('\n') === componentDirs.join('\n')) return false
    componentDirs = next
    server.watcher.add(next)
    const allow = server.config.server.fs.allow
    for (const dir of next) if (!allow.includes(dir)) allow.push(dir)
    return true
  }
  const ALL_IDS = [RESOLVED_ID, RESOLVED_COMPONENTS_ID, RESOLVED_EXTENSIONS_ID, RESOLVED_INK_ID]
  const invalidate = (server, ids) => {
    for (const id of ids) {
      const mod = server.moduleGraph.getModuleById(id)
      if (mod) server.moduleGraph.invalidateModule(mod)
    }
  }
  const reload = (server, ids, file) => {
    invalidate(server, ids)
    if (!editor) server.ws.send({ type: 'full-reload' })
    else if (file) server.ws.send('mdeck:extensions-changed', { file })
  }

  return {
    name: 'vite-plugin-slides',
    configureServer(server) {
      server.watcher.add([abs, inkPath, ...watchDirs()])
      const refresh = file => {
        if (isWatched(file)) reload(server, ALL_IDS, resolve(file))
        else if (resolve(file) === inkPath && !(() => { try { return isOwnWrite(inkPath, readFileSync(inkPath, 'utf-8')) } catch { return false } })()) reload(server, [RESOLVED_INK_ID], inkPath)
      }
      for (const event of ['add', 'unlink', 'addDir', 'unlinkDir']) server.watcher.on(event, refresh)
    },
    resolveId(id) {
      if (id === 'mdeck/template-api') throw new Error('mdeck/template-api is now mdeck/layout. Run mdeck migrate to update local imports.')
      if (id === 'mdeck/layout') return fileURLToPath(new URL('../layouts/layoutApi.jsx', import.meta.url))
      if (id === 'mdeck/live') return fileURLToPath(new URL('../live/client.js', import.meta.url))
      if (id === VIRTUAL_ID) return RESOLVED_ID
      if (id === COMPONENTS_ID) return RESOLVED_COMPONENTS_ID
      if (id === EXTENSIONS_ID) return RESOLVED_EXTENSIONS_ID
      if (id === INK_ID) return RESOLVED_INK_ID
    },
    load(id) {
      if (id === RESOLVED_ID) {
        this.addWatchFile(abs)
        const raw = readFileSync(abs, 'utf-8')
        const registry = loadRegistry(abs)
        for (const warning of registry.warnings) this.warn(warning)
        const diagnostics = validateDeck(parseSlides(raw), {
          layouts: manifestsOf(registry, 'layout'), themes: manifestsOf(registry, 'theme'), palettes: manifestsOf(registry, 'palette'),
        })
        const errors = diagnostics.filter(d => d.severity === 'error')
        if (errors.length && !editor) throw new Error(formatDiagnostics(errors, abs))
        if (diagnostics.length) this.warn(formatDiagnostics(diagnostics, abs))
        const source = maybeInlineAssets(stripNotes ? stripNotesFrom(raw) : raw, abs, { inlineImages, inlineMedia })
        return `export default ${JSON.stringify(source)}`
      }
      // The deck's saved ink (<deck>.drawings.json), scaled to its design size.
      // Builds bundle it, so the reader view and PDFs show it too.
      if (id === RESOLVED_INK_ID) {
        if (ink) assertDrawings(abs)
        // Only an existing file: Vite treats a missing watch file as a missing
        // import. The dev server's watcher notices the file once it appears.
        if (existsSync(inkPath)) this.addWatchFile(inkPath)
        let size = {}
        try { const config = parseSlides(readFileSync(abs, 'utf-8')).deckConfig ?? {}; size = { width: config.width ?? 1920, height: config.height ?? 1080 } } catch {}
        let data = emptyInk(size)
        if (ink && existsSync(inkPath)) {
          try { data = normalizeInk(JSON.parse(readFileSync(inkPath, 'utf-8')), size) } catch (error) { this.warn(`${inkPath}: ${error.message}; showing no ink`) }
        }
        return `export default ${JSON.stringify(data)}\nexport const inkFileName = ${JSON.stringify(basename(inkPath))}`
      }
      if (id === RESOLVED_EXTENSIONS_ID) {
        const registry = loadRegistry(abs)
        for (const record of registry.records) this.addWatchFile(record.file)
        return generateExtensionsModule(registry)
      }
      if (id === RESOLVED_COMPONENTS_ID) {
        const files = componentFiles(abs)
        const imports = files
          .map((f, i) => `import C${i} from ${JSON.stringify(f.file)}`)
          .join('\n')
        const entries = files
          .map((f, i) => `  ${JSON.stringify(f.tag)}: C${i},`)
          .join('\n')
        return `${imports}\nexport default {\n${entries}\n}\n`
      }
    },
    // The deck page carries the deck's language before any script runs, for
    // screen readers, hyphenation and search engines.
    // A single-file build also carries the theme's fonts (fonts.js).
    async transformIndexHtml(html, context) {
      if (!/(^|[\/])index\.html$/.test(context.filename ?? context.path ?? '')) return html
      let config = {}
      try { config = parseSlides(readFileSync(abs, 'utf-8')).deckConfig ?? {} } catch {}
      const lang = config.lang
      if (typeof lang === 'string' && /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(lang)) html = html.replace(/<html lang="[^"]*"/, `<html lang="${lang}"`)
      if (embedThemeFonts) {
        const theme = loadRegistry(abs).themes[config.theme ?? 'neue']?.manifest
        const { css, warnings } = await embedFonts(theme?.fonts ?? [])
        for (const warning of warnings) console.warn(`  ! ${warning}`)
        if (css) html = html.replace('</head>', `<style data-mdeck-fonts>\n${css}\n</style>\n</head>`)
      }
      return html
    },
    handleHotUpdate({ file, server }) {
      const changed = resolve(file)
      if (isWatched(changed)) {
        reload(server, ALL_IDS, changed)
        return []
      }
      // mdeck's own writes (saved ink, a new slide id) must not reload the
      // windows mid-talk: the pages refresh their ink on `mdeck:ink` instead.
      const own = [inkPath, abs].includes(changed) && (() => { try { return isOwnWrite(changed, readFileSync(changed, 'utf-8')) } catch { return false } })()
      if (own) {
        invalidate(server, changed === abs ? [RESOLVED_ID, RESOLVED_INK_ID] : [RESOLVED_INK_ID])
        return []
      }
      if (changed === inkPath) {
        reload(server, [RESOLVED_INK_ID], changed)
        return []
      }
      if (changed === abs) {
        if (followComponentFolders(server)) {
          reload(server, ALL_IDS, changed)
          return []
        }
        // The ink is scaled to the deck's design size, which the deck sets.
        invalidate(server, [RESOLVED_ID, RESOLVED_INK_ID])
        if (editor) return []
        server.ws.send({ type: 'full-reload' })
      }
    },
  }
}
