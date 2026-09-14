import { readFileSync, existsSync, readdirSync } from 'fs'
import { resolve, dirname, basename, sep } from 'path'
import { parseSlides } from '../core/parseSlides.js'
import { validateDeck, formatDiagnostics } from '../core/validateDeck.js'
import { loadRegistry, extensionRoots, manifestsOf } from '../extensions/discover.js'
import { stripNotes as stripNotesFrom } from '../core/editDeck.js'
import { fileURLToPath } from 'node:url'
import { marked } from 'marked'

const VIRTUAL_ID = 'virtual:slides'
const RESOLVED_ID = '\0virtual:slides'

const COMPONENTS_ID = 'virtual:deck-components'
const RESOLVED_COMPONENTS_ID = '\0virtual:deck-components'
const EXTENSIONS_ID = 'virtual:mdeck-extensions'
const RESOLVED_EXTENSIONS_ID = '\0virtual:mdeck-extensions'

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
    const bodies = [...Object.values(slide.regions).map(r => r.content), slide.meta.notes ?? slide.meta.note ?? '']
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

function maybeInlineAssets(markdown, abs, { inlineImages, inlineMedia }) {
  if (!inlineImages && !inlineMedia) return markdown
  const baseDir = dirname(abs)
  let out = markdown
  if (inlineImages) out = inlineMarkdownImages(out, baseDir)
  if (inlineImages) out = inlineHtmlImgSources(out, baseDir)
  if (inlineImages) out = inlineYamlImageFields(out, baseDir)
  if (inlineMedia) out = inlineHtmlMediaSources(out, baseDir)
  return out
}

// ─── Deck-local components ────────────────────────────────────────────────
// A deck may ship its own Preact components in a `components/` folder next to
// the .md file. Each `*.jsx` file's default export is registered under its
// lowercased filename, so `components/Tokenizer.jsx` becomes `<tokenizer>`.
// Deck components override built-ins of the same name.

function deckComponentsDir(abs) {
  return resolve(dirname(abs), 'components')
}

function deckComponentFiles(abs) {
  const dir = deckComponentsDir(abs)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(name => /\.jsx$/.test(name))
    .sort()
    .map(name => ({
      tag: basename(name, '.jsx').toLowerCase(),
      file: resolve(dir, name),
    }))
}

// ─── Extension registry module ────────────────────────────────────────────
// Templates, themes and palettes are discovered in Node and handed to the
// browser as one generated module. Template layouts and styles are imported
// eagerly; theme stylesheets stay lazy so only the chosen theme is loaded.
// Layout JSX is trusted code, not sandboxed data.

export function generateExtensionsModule(registry) {
  const imports = []
  const templates = Object.values(registry.templates).map((t, i) => {
    imports.push(`import L${i} from ${JSON.stringify(t.files.layout)}`, ...t.files.styles.map(s => `import ${JSON.stringify(s)}`))
    return `${JSON.stringify(t.id)}: { manifest: ${JSON.stringify(t.manifest)}, render: L${i} }`
  })
  const themes = Object.values(registry.themes).map(t => {
    const loads = t.files.styles.map(s => `import(${JSON.stringify(s + '?inline')})`)
    return `${JSON.stringify(t.id)}: { manifest: ${JSON.stringify(t.manifest)}, load: () => Promise.all([${loads.join(', ')}]).then(mods => mods.map(m => m.default).join('\\n')) }`
  })
  const palettes = Object.values(registry.palettes).map(p => `${JSON.stringify(p.id)}: { manifest: ${JSON.stringify(p.manifest)} }`)
  return `${imports.join('\n')}\nexport const templates = {\n${templates.join(',\n')}\n}\nexport const themes = {\n${themes.join(',\n')}\n}\nexport const palettes = {\n${palettes.join(',\n')}\n}\n`
}

// `editor` keeps the page alive while `mdeck edit` rewrites the deck: deck
// changes only invalidate the module, validation errors are warnings, and
// extension changes are announced instead of forcing a reload.
export function slidesPlugin(slidesPath, { inlineImages = false, inlineMedia = false, editor = false, stripNotes = false } = {}) {
  const abs = resolve(slidesPath)
  const watchDirs = [...extensionRoots(abs).map(root => root.dir), deckComponentsDir(abs)]
  const isWatched = file => watchDirs.some(dir => resolve(file).startsWith(dir + sep))
  const ALL_IDS = [RESOLVED_ID, RESOLVED_COMPONENTS_ID, RESOLVED_EXTENSIONS_ID]
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
      server.watcher.add([abs, ...watchDirs])
      const refresh = file => { if (isWatched(file)) reload(server, ALL_IDS, resolve(file)) }
      for (const event of ['add', 'unlink', 'addDir', 'unlinkDir']) server.watcher.on(event, refresh)
    },
    resolveId(id) {
      if (id === 'mdeck/template-api') return fileURLToPath(new URL('../templates/templateApi.jsx', import.meta.url))
      if (id === VIRTUAL_ID) return RESOLVED_ID
      if (id === COMPONENTS_ID) return RESOLVED_COMPONENTS_ID
      if (id === EXTENSIONS_ID) return RESOLVED_EXTENSIONS_ID
    },
    load(id) {
      if (id === RESOLVED_ID) {
        this.addWatchFile(abs)
        const raw = readFileSync(abs, 'utf-8')
        const registry = loadRegistry(abs)
        for (const warning of registry.warnings) this.warn(warning)
        const diagnostics = validateDeck(parseSlides(raw), {
          templates: manifestsOf(registry, 'template'), themes: manifestsOf(registry, 'theme'), palettes: manifestsOf(registry, 'palette'),
        })
        const errors = diagnostics.filter(d => d.severity === 'error')
        if (errors.length && !editor) throw new Error(formatDiagnostics(errors, abs))
        if (diagnostics.length) this.warn(formatDiagnostics(diagnostics, abs))
        const source = maybeInlineAssets(stripNotes ? stripNotesFrom(raw) : raw, abs, { inlineImages, inlineMedia })
        return `export default ${JSON.stringify(source)}`
      }
      if (id === RESOLVED_EXTENSIONS_ID) {
        const registry = loadRegistry(abs)
        for (const record of registry.records) this.addWatchFile(record.file)
        return generateExtensionsModule(registry)
      }
      if (id === RESOLVED_COMPONENTS_ID) {
        const files = deckComponentFiles(abs)
        const imports = files
          .map((f, i) => `import C${i} from ${JSON.stringify(f.file)}`)
          .join('\n')
        const entries = files
          .map((f, i) => `  ${JSON.stringify(f.tag)}: C${i},`)
          .join('\n')
        return `${imports}\nexport default {\n${entries}\n}\n`
      }
    },
    handleHotUpdate({ file, server }) {
      const changed = resolve(file)
      if (isWatched(changed)) {
        reload(server, ALL_IDS, changed)
        return []
      }
      if (changed === abs) {
        invalidate(server, [RESOLVED_ID])
        if (editor) return []
        server.ws.send({ type: 'full-reload' })
      }
    },
  }
}
