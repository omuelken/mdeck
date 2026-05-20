import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'

const VIRTUAL_ID = 'virtual:slides'
const RESOLVED_ID = '\0virtual:slides'

const MIME_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
}

function isLocalAssetRef(ref = '') {
  return ref
    && !/^([a-z]+:)?\/\//i.test(ref)
    && !ref.startsWith('data:')
    && !ref.startsWith('#')
}

function toDataUrl(ref, baseDir) {
  if (!isLocalAssetRef(ref)) return null
  const q = ref.indexOf('?')
  const h = ref.indexOf('#')
  const end = [q, h].filter(i => i !== -1).sort((a, b) => a - b)[0] ?? ref.length
  const cleanRef = ref.slice(0, end)
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

function inlineYamlImageFields(markdown, baseDir) {
  return markdown.replace(/^(\s*)(image|logo):\s*(["']?)([^"'\n]+)\3\s*$/gm, (m, indent, key, quote, value) => {
    const dataUrl = toDataUrl(value.trim(), baseDir)
    if (!dataUrl) return m
    const q = quote || '"'
    return `${indent}${key}: ${q}${dataUrl}${q}`
  })
}

function maybeInlineImages(markdown, abs, inlineImages) {
  if (!inlineImages) return markdown
  const baseDir = dirname(abs)
  let out = markdown
  out = inlineMarkdownImages(out, baseDir)
  out = inlineHtmlImgSources(out, baseDir)
  out = inlineYamlImageFields(out, baseDir)
  return out
}

export function slidesPlugin(slidesPath, { inlineImages = false } = {}) {
  const abs = resolve(slidesPath)

  return {
    name: 'vite-plugin-slides',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID
    },
    load(id) {
      if (id === RESOLVED_ID) {
        const raw = readFileSync(abs, 'utf-8')
        const source = maybeInlineImages(raw, abs, inlineImages)
        return `export default ${JSON.stringify(source)}`
      }
    },
    handleHotUpdate({ file, server }) {
      if (resolve(file) === abs) {
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
        if (mod) server.moduleGraph.invalidateModule(mod)
        server.ws.send({ type: 'full-reload' })
      }
    },
  }
}
