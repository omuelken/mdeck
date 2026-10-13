import { useEffect, useState } from 'preact/hooks'
import { currentBibliography, onBibliography } from '../runtime/citations.js'

// <bibliography /> on a slide: the deck's reference list, the works it cites
// plus `nocite`, in the citation style's order. A long list goes over several
// slides with <bibliography part="1/2" /> and <bibliography part="2/2" />.
// `keys="a b"` lists only these works; in a deck that includes another, that
// deck's own list gets the keys it cites (build/include.js), so it shows what
// it shows alone.

function slice(order, part) {
  const match = String(part ?? '').match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/)
  if (!match) return order
  const [index, count] = [Number(match[1]), Number(match[2])]
  if (!count || index < 1 || index > count) return order
  const size = Math.ceil(order.length / count)
  return order.slice((index - 1) * size, index * size)
}

export default function Bibliography({ part, keys }) {
  const [bib, setBib] = useState(currentBibliography)
  useEffect(() => onBibliography(setBib), [])
  if (!bib) return <p class="bibliography-hint">Name a reference file in the deck settings, e.g. <code>bibliography: refs.bib</code>.</p>
  const only = keys == null ? null : new Set(String(keys).split(/[\s,]+/).map(key => key.replace(/^@/, '')).filter(Boolean))
  const order = only ? bib.order.filter(id => only.has(id)) : bib.order
  const html = slice(order, part).map(id => bib.entries[id]).join('')
  return <div class="bibliography csl-bib-body" dangerouslySetInnerHTML={{ __html: html }} />
}
