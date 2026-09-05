import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { Marked } from 'marked'
import Prism from 'prismjs'
import 'prismjs/components/prism-markdown.js'
import 'prismjs/components/prism-yaml.js'
import 'prismjs/components/prism-jsx.js'
import 'prismjs/components/prism-bash.js'
import { pages } from './pages.js'

export const docsRoot = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(docsRoot, '..')
const exec = promisify(execFile)
export const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const plain = html => html.replace(/<[^>]*>/g, '').replace(/&(?:amp|lt|gt|quot|#39);/g, value => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" })[value])

function navigation(current) {
  const groups = [...new Set(pages.map(p => p.group))]
  return groups.map(group => {
    const links = pages.filter(p => p.group === group).map(p => `<a href="${p.slug}.html"${p.slug === current.slug ? ' aria-current="page"' : ''}>${escape(p.title)}</a>`).join('')
    if (group === 'Advanced customization') return `<details class="advanced-nav"${current.group === group ? ' open' : ''}><summary>${group}</summary><div>${links}</div></details>`
    return `<div class="nav-group"><p>${group}</p>${links}</div>`
  }).join('')
}

function preview(page) {
  if (!page.preview) return ''
  const custom = page.preview === 'custom-templates'
  return `<figure class="slide-example" data-preview>
    <figcaption><span>${custom ? 'A reusable comparison design' : 'A presentation you can try'}</span><a href="examples/${page.preview}.html" target="_blank" rel="noopener">Open slides</a></figcaption>
    <iframe title="${custom ? 'Comparison slide example' : 'Example presentation'}" src="examples/${page.preview}.html?embedded=1" loading="lazy"></iframe>
    <div class="preview-controls"><div><button type="button" data-control="prev" aria-label="Previous slide or point">Previous</button><button type="button" data-control="next" aria-label="Next slide or point">Next</button><output aria-live="polite">Slide 1</output></div><label>Look <select aria-label="Example theme"><option value="neue">Neue</option><option value="editorial">Editorial</option><option value="duet">Duet</option><option value="terminal">Terminal</option><option value="aurora">Aurora</option><option value="fhnw">FHNW</option></select></label></div>
  </figure>`
}

export function renderPage(page, markdown) {
  const headings = [], used = new Map()
  let title = page.title
  const firstHeading = markdown.match(/^# (.+)\r?$/m)
  if (firstHeading) { title = firstHeading[1]; markdown = markdown.replace(firstHeading[0], '') }
  const renderer = {
    heading(text, level) {
      const base = plain(text).toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-') || 'section'
      const count = used.get(base) ?? 0
      used.set(base, count + 1)
      const id = base + (count ? `-${count + 1}` : '')
      if (level === 2) headings.push({ id, text: plain(text) })
      return `<h${level} id="${id}">${text}<a class="heading-link" href="#${id}" aria-label="Link to ${escape(plain(text))}">#</a></h${level}>\n`
    },
    code(code, info) {
      const language = (info ?? '').split(/\s/)[0]
      const grammar = Prism.languages[{ sh: 'bash', html: 'markup', text: 'plain' }[language] ?? language]
      const html = grammar ? Prism.highlight(code, grammar, language) : escape(code)
      return `<figure class="code-example"><figcaption><span>${language === 'sh' ? 'In your terminal' : 'Example'}</span><button type="button" data-copy aria-label="Copy example">Copy</button></figcaption><pre><code>${html}</code></pre></figure>\n`
    },
    table(header, body) { return `<div class="table-scroll" tabindex="0" role="region" aria-label="Reference table"><table><thead>${header}</thead><tbody>${body}</tbody></table></div>` },
    link(href, linkTitle, text) {
      const aliases = { 'templates.md': 'custom-templates.html', '../examples/custom-templates/slides.md': 'downloads/comparison.md' }
      href = aliases[href] ?? href
      return `<a href="${escape(href)}"${linkTitle ? ` title="${escape(linkTitle)}"` : ''}>${text}</a>`
    },
  }
  const parser = new Marked({ renderer })
  const article = parser.parse(markdown).replace('<!-- preview -->', preview(page))
  const index = pages.indexOf(page)
  const previous = pages[index - 1], next = pages[index + 1]
  const footerLinks = `${previous ? `<a href="${previous.slug}.html"><small>Previous guide</small>${escape(previous.title)}</a>` : '<span></span>'}${next ? `<a href="${next.slug}.html"><small>Next guide</small>${escape(next.title)}</a>` : ''}`
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="${escape(page.description)}"><title>${escape(page.title)} · mdeck guide</title><link rel="icon" href="assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="assets/site.css"><script src="assets/site.js" defer></script></head>
<body${page.slug === 'index' ? ' class="welcome"' : ''}>
<a class="skip-link" href="#main">Skip to the guide</a>
<header class="site-header"><a class="brand" href="index.html" aria-label="mdeck documentation home"><svg viewBox="0 0 36 30" aria-hidden="true"><path d="M3 4h24v18H3zM9 10h24v18H9z"/><path d="M15 17h12M15 21h8"/></svg><span>mdeck</span><span class="brand-guide">Guide</span></a>
<div class="search-box" role="search"><label for="search" class="sr-only">Search the guides</label><input id="search" type="search" placeholder="Search the guides" autocomplete="off" aria-controls="search-results" aria-expanded="false"><kbd aria-hidden="true">/</kbd><div id="search-results" hidden></div><span id="search-status" class="sr-only" aria-live="polite"></span></div></header>
<div class="site-layout"><details class="nav-shell" open><summary>Browse the guides</summary><nav aria-label="Documentation">${navigation(page)}<a class="nav-help" href="commands.html">Open these docs: <code>mdeck docs</code></a></nav></details>
<main id="main" tabindex="-1"><article><header class="article-header"><p class="breadcrumb">${escape(page.group)}</p><h1>${escape(title)}</h1>${page.group === 'Advanced customization' ? '<p class="advanced-notice">This section is for people comfortable with code. You can make and present slides without it.</p>' : ''}</header>${article}</article><nav class="page-navigation" aria-label="Previous and next guide">${footerLinks}</nav><footer class="article-footer">mdeck guide <span>Made to read at your own pace.</span></footer></main>
<aside class="page-outline" aria-label="On this page"><p>On this page</p>${headings.map(h => `<a href="#${h.id}">${escape(h.text)}</a>`).join('')}</aside></div></body></html>`
  return { html, headings, search: { title: page.title, href: `${page.slug}.html`, description: page.description, text: plain(article).replace(/\s+/g, ' ').trim() } }
}

export async function buildDocs({ outDir = resolve(docsRoot, 'dist'), examples = true } = {}) {
  await mkdir(resolve(outDir, 'assets'), { recursive: true })
  await mkdir(resolve(outDir, 'downloads'), { recursive: true })
  const search = []
  for (const page of pages) {
    const file = page.source ? resolve(docsRoot, page.source) : resolve(docsRoot, 'content', page.file)
    const { html, search: entry } = renderPage(page, await readFile(file, 'utf8'))
    await writeFile(resolve(outDir, `${page.slug}.html`), html)
    search.push(entry)
  }
  for (const file of ['site.css', 'site.js', 'favicon.svg']) await copyFile(resolve(docsRoot, 'assets', file), resolve(outDir, 'assets', file))
  await writeFile(resolve(outDir, 'search.json'), JSON.stringify(search))
  await copyFile(resolve(projectRoot, 'examples/custom-templates/slides.md'), resolve(outDir, 'downloads/comparison.md'))
  await copyFile(resolve(docsRoot, 'examples/first-talk.md'), resolve(outDir, 'downloads/first-talk.md'))
  if (examples) {
    for (const [name, file] of [['first-talk', resolve(docsRoot, 'examples/first-talk.md')], ['custom-templates', resolve(projectRoot, 'examples/custom-templates/slides.md')]]) {
      await exec(process.execPath, [resolve(projectRoot, 'cli.js'), 'build', file, '--self-contained', '-o', resolve(outDir, 'examples', `${name}.html`)], { cwd: projectRoot, maxBuffer: 4 * 1024 * 1024 })
    }
  }
  return outDir
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Documentation built: ${await buildDocs()}`)
}
