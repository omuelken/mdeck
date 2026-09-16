// Renders a built deck to PDF with a local headless Chrome, using the deck's
// own print rules: one slide per page at the design size, vector text.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { launchChrome, findChrome } from './chrome.js'

export { findChrome }

export async function renderPdf({ htmlFile, output, chrome = findChrome(), timeout = 90000 }) {
  const html = resolve(htmlFile)
  const browser = await launchChrome({ dir: dirname(html), chrome, timeout })
  try {
    const page = await browser.open(`${encodeURIComponent(basename(html))}?view=deck&embedded=1`)
    await page.waitForDeck()
    await delay(300)
    const { data } = await page.send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 })
    writeFileSync(output, Buffer.from(data, 'base64'))
    return output
  } finally {
    await browser.close()
  }
}

// Points the share view at the PDF: a relative link for folders, an embedded
// data URI for single files.
export function attachPdf(htmlFile, pdfFile, { embed = false } = {}) {
  const html = readFileSync(htmlFile, 'utf8').replace(/<link rel="alternate" type="application\/pdf"[^>]*>/, '')
  const href = embed ? `data:application/pdf;base64,${readFileSync(pdfFile).toString('base64')}` : encodeURIComponent(basename(pdfFile))
  const link = `<link rel="alternate" type="application/pdf" href="${href}">`
  writeFileSync(htmlFile, html.includes('</head>') ? html.replace('</head>', `${link}</head>`) : link + html)
}
