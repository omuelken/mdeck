// The <data> tag holds its table as CSV between its tags:
//
//   <data show="bar" title="Yield per hectare">
//   year, wheat, barley
//   2023, 6.4, 6.2
//   </data>
//
// or names a file beside the deck: <data src="yields.csv" />. Before a slide
// is drawn, and before `mdeck check` reads it, the text between the tags
// moves into the tag as `data-csv`, so Markdown never reads it as a list or
// a heading and a blank line in it does not end the tag, as a poll's list
// becomes its options (pollList.js).
import { tagsIn, closingTagOf } from './tags.js'

const attributeText = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/\n/g, '&#10;')

/** `markdown` with the CSV of every <data> tag moved into its `data-csv` attribute. */
export function expandDataTags(markdown) {
  const source = String(markdown ?? '')
  if (!/<data\b/i.test(source)) return source
  const text = source.replace(/\r\n?/g, '\n')
  // A tag already carrying its data (a second pass) stays as it is.
  const tags = tagsIn(text)
  let out = '', last = 0
  tags.forEach((open, at) => {
    if (open.name !== 'data' || open.closing || open.selfClosing || open.start == null || open.start < last || open.attrs['data-csv'] != null) return
    const close = closingTagOf(tags, at)
    if (close?.start == null) return
    const csv = text.slice(open.end, close.start)
    // On a line of its own, the tag is one block of HTML, as <data … /> is.
    out += text.slice(last, open.start) + `${open.raw.slice(0, -1).trimEnd()} data-csv="${attributeText(csv.replace(/^\n|\n[ \t]*$/g, ''))}">\n</data>`
    last = close.end
  })
  return last ? out + text.slice(last) : source
}

/** Every <data> tag of a slide's text: [{ attrs, csv }], `csv` null for a file (`src`). */
export function dataTagsIn(markdown) {
  return tagsIn(expandDataTags(markdown))
    .filter(tag => tag.name === 'data' && !tag.closing)
    .map(tag => ({ attrs: tag.attrs, csv: tag.attrs['data-csv'] ?? null }))
}
