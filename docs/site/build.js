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
import { frameworkRoot as projectRoot } from '../../src/paths.js'
import { loadRegistry } from '../../src/extensions/discover.js'
import { createRequire } from 'node:module'

const REPO = 'https://gitlab.fhnw.ch/tilman.schieber/mdeck'
const LINKS = [['Repository', REPO], ['Releases', `${REPO}/-/releases`], ['Package', `${REPO}/-/packages`], ['Issues', `${REPO}/-/issues`]]
const version = createRequire(import.meta.url)('../../package.json').version
const projectLinks = () => LINKS.map(([label, href]) => `<a href="${href}" rel="noopener">${label}</a>`).join('')
import { parseSlides } from '../../src/core/parseSlides.js'
import { readFileSync } from 'node:fs'

export const docsRoot = dirname(fileURLToPath(import.meta.url))
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

const exampleFiles = { 'first-talk': resolve(docsRoot, 'examples/first-talk.md'), 'custom-templates': resolve(projectRoot, 'examples/custom-templates/slides.md') }

// The theme picker lists every registered theme and starts on the example's own design.
function themeOptions(exampleFile) {
  const current = parseSlides(readFileSync(exampleFile, 'utf8')).deckConfig.design ?? 'neue'
  const themes = loadRegistry(exampleFile).themes
  return Object.values(themes).map(theme => `<option value="${theme.id}"${theme.id === current ? ' selected' : ''}>${escape(theme.title)}</option>`).join('')
}

function preview(page) {
  if (!page.preview) return ''
  const custom = page.preview === 'custom-templates'
  return `<figure class="slide-example" data-preview>
    <figcaption><span>${custom ? 'A reusable comparison design' : 'A presentation you can try'}</span><a href="examples/${page.preview}.html?palette=&amp;accent=&amp;accent2=" target="_blank" rel="noopener">Open slides</a></figcaption>
    <iframe title="${custom ? 'Comparison slide example' : 'Example presentation'}" src="examples/${page.preview}.html?embedded=1&amp;palette=&amp;accent=&amp;accent2=" loading="lazy"></iframe>
    <div class="preview-controls"><div><button type="button" data-control="prev" aria-label="Previous slide or point">Previous</button><button type="button" data-control="next" aria-label="Next slide or point">Next</button><output aria-live="polite">Slide 1</output></div><label>Look <select aria-label="Example theme">${themeOptions(exampleFiles[page.preview])}</select></label></div>
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
      const aliases = { 'templates.md': 'custom-templates.html', 'extensions.md': 'extensions.html', 'themes.md': 'theme-authoring.html', 'palettes.md': 'theme-authoring.html', '../../examples/custom-templates/slides.md': 'downloads/comparison.md' }
      href = href.replace(/^extensions\.md#/, 'extensions.html#')
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
<header class="site-header"><a class="brand" href="index.html" aria-label="mdeck documentation home"><img src="assets/favicon.svg" alt="" width="26" height="26"><span>mdeck</span><span class="brand-guide">Guide</span></a>
<div class="header-tools"><div class="search-box" role="search"><label for="search" class="sr-only">Search the guides</label><input id="search" type="search" placeholder="Search the guides" autocomplete="off" aria-controls="search-results" aria-expanded="false"><kbd aria-hidden="true">/</kbd><div id="search-results" hidden></div><span id="search-status" class="sr-only" aria-live="polite"></span></div>
<a class="repo-link" href="https://gitlab.fhnw.ch/tilman.schieber/mdeck" rel="noopener"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M23.6 9.6l-1.3-4a.6.6 0 0 0-1.1 0L19.3 11H4.7L2.8 5.6a.6.6 0 0 0-1.1 0l-1.3 4c-.2.7 0 1.4.6 1.8L12 20.5l11-9.1c.6-.4.8-1.1.6-1.8z"/></svg>GitLab</a></div></header>
<div class="site-layout"><details class="nav-shell" open><summary>Browse the guides</summary><nav aria-label="Documentation">${navigation(page)}<a class="nav-help" href="commands.html">Open these docs: <code>mdeck docs</code></a><div class="nav-links"><p>mdeck ${escape(version)} on GitLab</p>${projectLinks()}</div></nav></details>
<main id="main" tabindex="-1"><article><header class="article-header"><p class="breadcrumb">${escape(page.group)}</p><h1>${escape(title)}</h1>${page.group === 'Advanced customization' ? '<p class="advanced-notice">This section is for people comfortable with code. You can make and present slides without it.</p>' : ''}</header>${article}</article><nav class="page-navigation" aria-label="Previous and next guide">${footerLinks}</nav><footer class="article-footer"><span>mdeck ${escape(version)}</span><span class="footer-links">${projectLinks()}</span></footer></main>
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
    for (const [name, file] of Object.entries(exampleFiles)) {
      await exec(process.execPath, [resolve(projectRoot, 'bin/mdeck.js'), 'build', file, '--self-contained', '-o', resolve(outDir, 'examples', `${name}.html`)], { cwd: projectRoot, maxBuffer: 4 * 1024 * 1024 })
    }
  }
  return outDir
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Documentation built: ${await buildDocs()}`)
}
