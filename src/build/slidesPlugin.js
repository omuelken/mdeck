import { readFileSync, existsSync, readdirSync } from 'fs'
import { resolve, dirname, basename } from 'path'
import { parseSlides } from '../core/parseSlides.js'
import { validateDeck, formatDiagnostics } from '../core/validateDeck.js'
import { discoverTemplates } from './discoverTemplates.js'
import { builtinManifests } from '../templates/templateManifests.js'
import { fileURLToPath } from 'node:url'
import { marked } from 'marked'

const VIRTUAL_ID = 'virtual:slides'
const RESOLVED_ID = '\0virtual:slides'

const COMPONENTS_ID = 'virtual:deck-components'
const RESOLVED_COMPONENTS_ID = '\0virtual:deck-components'
const TEMPLATES_ID = 'virtual:deck-templates'
const RESOLVED_TEMPLATES_ID = '\0virtual:deck-templates'

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

export function slidesPlugin(slidesPath, { inlineImages = false, inlineMedia = false } = {}) {
  const abs = resolve(slidesPath)

  return {
    name: 'vite-plugin-slides',
    configureServer(server) {
      const templateDir = resolve(dirname(abs), 'templates')
      const componentDir = deckComponentsDir(abs)
      server.watcher.add([abs, templateDir, componentDir])
      const refresh = file => {
        const changed = resolve(file)
        if (![templateDir, componentDir].some(dir => changed.startsWith(dir + '/'))) return
        for (const id of [RESOLVED_ID, RESOLVED_COMPONENTS_ID, RESOLVED_TEMPLATES_ID]) {
          const mod = server.moduleGraph.getModuleById(id)
          if (mod) server.moduleGraph.invalidateModule(mod)
        }
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('add', refresh)
      server.watcher.on('unlink', refresh)
    },
    resolveId(id) {
      if (id === 'mdeck/template-api') return fileURLToPath(new URL('../templates/templateApi.jsx', import.meta.url))
      if (id === VIRTUAL_ID) return RESOLVED_ID
      if (id === COMPONENTS_ID) return RESOLVED_COMPONENTS_ID
      if (id === TEMPLATES_ID) return RESOLVED_TEMPLATES_ID
    },
    load(id) {
      if (id === RESOLVED_ID) {
        this.addWatchFile(abs)
        const raw = readFileSync(abs, 'utf-8')
        const templates = { ...builtinManifests, ...Object.fromEntries(discoverTemplates(abs).map(t => [t.manifest.name, t.manifest])) }
        const diagnostics = validateDeck(parseSlides(raw), { templates })
        const errors = diagnostics.filter(d => d.severity === 'error')
        if (errors.length) throw new Error(formatDiagnostics(errors, abs))
        if (diagnostics.length) this.warn(formatDiagnostics(diagnostics, abs))
        const source = maybeInlineAssets(raw, abs, { inlineImages, inlineMedia })
        return `export default ${JSON.stringify(source)}`
      }
      if (id === RESOLVED_TEMPLATES_ID) {
        const templates = discoverTemplates(abs)
        const imports = templates.map((t, i) => `import T${i} from ${JSON.stringify(t.layout)};${t.styles ? `\nimport ${JSON.stringify(t.styles)};` : ''}`).join('\n')
        const entries = templates.map((t, i) => `${JSON.stringify(t.manifest.name)}: { manifest: ${JSON.stringify(t.manifest)}, render: T${i} }`).join(',\n')
        return `${imports}\nexport default {${entries}}`
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
      if (changed.startsWith(resolve(dirname(abs), 'templates') + '/')) {
        for (const id of [RESOLVED_TEMPLATES_ID, RESOLVED_ID]) {
          const mod = server.moduleGraph.getModuleById(id)
          if (mod) server.moduleGraph.invalidateModule(mod)
        }
        server.ws.send({ type: 'full-reload' })
        return []
      }
      if (changed.startsWith(deckComponentsDir(abs) + '/')) {
        const mod = server.moduleGraph.getModuleById(RESOLVED_COMPONENTS_ID)
        if (mod) server.moduleGraph.invalidateModule(mod)
        server.ws.send({ type: 'full-reload' })
        return
      }
      if (changed === abs) {
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
        if (mod) server.moduleGraph.invalidateModule(mod)
        server.ws.send({ type: 'full-reload' })
      }
    },
  }
}
