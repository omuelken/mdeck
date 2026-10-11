// What `mdeck check` says about the deck's SVG drawings. A drawing that uses
// the palette (var(--…)) is drawn into the page, where it should follow the
// palette everywhere, work without it, and leave the rest of the page alone.
// One that does not is shown as a picture and cannot build up or be zoomed to.

const COLOUR_ATTRIBUTE = /\s(fill|stroke|stop-color|flood-color|lighting-color|color)\s*=\s*(["'])([^"']*)\2/gi
const COLOUR_PROPERTY = /(?<![\w-])(fill|stroke|stop-color|flood-color|lighting-color|color)\s*:\s*([^;}"']+)/gi
const FOLLOWS = /^(none|transparent|currentcolor|inherit|initial|unset|context-fill|context-stroke)$|^(var|url)\(/i

// [{ code, message }] for one drawing's markup.
export function svgProblems(markup) {
  markup = markup.replace(/<!--[\s\S]*?-->/g, '')
  const problems = []
  const themed = /var\(--/.test(markup)
  const steps = [...markup.matchAll(/\sdata-step(?:\s*=\s*(["'])([^"']*)\1)?/g)].map(match => (match[2] ?? '').trim())
  if (!themed) {
    if (steps.length || /\sdata-hotspot\b/.test(markup)) problems.push({ code: 'svg-not-inline', message: 'has data-step or data-hotspot, but uses no palette colour (var(--…)), so it is shown as a picture and they do nothing; give one colour as var(--ink, #222)' })
    return problems
  }
  const bare = [...markup.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)].map(match => match[1])
  if (bare.length) problems.push({ code: 'svg-fallback', message: `uses ${unique(bare).map(name => `var(${name})`).join(', ')} without a fallback, which shows nothing where the drawing is opened on its own; write var(${bare[0]}, #…)` })
  const fixed = [
    ...[...markup.matchAll(COLOUR_ATTRIBUTE)].map(match => [match[1], match[3].trim()]),
    ...[...styleText(markup).matchAll(COLOUR_PROPERTY), ...inlineStyles(markup).flatMap(style => [...style.matchAll(COLOUR_PROPERTY)])].map(match => [match[1], match[2].trim()]),
  ].filter(([, value]) => value && !FOLLOWS.test(value))
  if (fixed.length) {
    const examples = unique(fixed.map(([name, value]) => `${name}="${value}"`)).slice(0, 3).join(', ')
    problems.push({ code: 'svg-fixed-colour', message: `has ${fixed.length === 1 ? 'a fixed colour' : `${fixed.length} fixed colours`} (${examples}) that stay${fixed.length === 1 ? 's' : ''} the same in every palette and in dark mode; use var(--ink, …) or another palette colour where it should follow` })
  }
  const unscoped = unique(selectors(styleText(markup)).filter(selector => !selector.startsWith('.')))
  if (unscoped.length) problems.push({ code: 'svg-style', message: `has style rules that reach the whole page (${unscoped.slice(0, 3).join(', ')}), its icons, QR codes and other drawings included; start each with a class of this drawing, such as .flow-` })
  if (steps.some(Boolean) && steps.some(step => !step)) problems.push({ code: 'svg-steps', message: 'has numbered and bare data-step parts: the numbered ones show together in their order, the bare ones in document order. Number all of them' })
  return problems
}

const unique = items => [...new Set(items)]

const styleText = markup => [...markup.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(match => match[1].replace(/<!\[CDATA\[|\]\]>/g, '')).join('\n')
const inlineStyles = markup => [...markup.matchAll(/\sstyle\s*=\s*(["'])([^"']*)\1/gi)].map(match => match[2])

// The selectors of a stylesheet's rules, also inside @media; not the steps
// of @keyframes.
function selectors(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const found = []
  let depth = 0
  let skipUntil = -1
  let start = 0
  for (let i = 0; i < css.length; i++) {
    if (css[i] === '{') {
      const prelude = css.slice(start, i).trim()
      if (skipUntil < 0) {
        if (/^@keyframes\b|^@font-face\b/i.test(prelude)) skipUntil = depth
        else if (prelude && !prelude.startsWith('@')) found.push(...prelude.split(',').map(s => s.trim()).filter(Boolean))
      }
      depth++
      start = i + 1
    } else if (css[i] === '}') {
      depth--
      if (depth === skipUntil) skipUntil = -1
      start = i + 1
    } else if (css[i] === ';' && depth === 0) start = i + 1
  }
  return found
}
