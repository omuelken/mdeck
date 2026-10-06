import { createServer } from 'node:http'
import { readFile, mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, relative, extname, isAbsolute } from 'node:path'
import { spawn } from 'node:child_process'
import { buildDocs } from './build.js'
import { pageFor } from './pages.js'

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.md': 'text/plain; charset=utf-8' }

export function docsHandler(root) {
  return async (request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return }
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
      const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname))
      const rel = relative(root, file)
      if (rel.startsWith('..') || isAbsolute(rel) || !(await stat(file)).isFile()) throw new Error('Not found')
      const content = await readFile(file)
      response.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream', 'Content-Length': content.length, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' })
      response.end(request.method === 'HEAD' ? undefined : content)
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
      response.end(request.method === 'HEAD' ? undefined : '<!doctype html><html lang="en"><title>Guide not found</title><h1>That guide could not be found.</h1><p><a href="/">Go back to the mdeck guide.</a></p></html>')
    }
  }
}

export async function startDocs({ page = 'index', port = 4174, open = true } = {}) {
  if (!pageFor(page)) throw new Error(`There is no guide named "${page}". Try "getting-started", "sharing", or "commands".`)
  const outDir = await mkdtemp(resolve(tmpdir(), 'mdeck-docs-'))
  let server
  try {
    await buildDocs({ outDir })
    server = createServer(docsHandler(outDir))
    for (let attempt = 0; ; attempt++) {
      try {
        await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => { server.removeListener('error', reject); resolve() }) })
        break
      } catch (error) {
        if (error.code !== 'EADDRINUSE' || attempt >= 20 || port >= 65535) throw error
        port++
      }
    }
    const url = `http://127.0.0.1:${server.address().port}/${page === 'index' ? '' : `${page}.html`}`
    if (open) {
      const [command, args] = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', url]] : ['xdg-open', [url]]
      const opener = spawn(command, args, { stdio: 'ignore' })
      opener.on('error', () => console.log(`Open ${url} in your browser.`))
      opener.unref()
    }
    return { server, url, outDir, async close() { await new Promise(resolve => server.close(resolve)); await rm(outDir, { recursive: true, force: true }) } }
  } catch (error) {
    server?.close()
    await rm(outDir, { recursive: true, force: true })
    throw error
  }
}
