const VIEWS = new Set(['deck', 'reader', 'presenter', 'audience'])
const OLD_VIEWS = { d: 'deck', s: 'reader', p: 'presenter', a: 'audience', share: 'reader' }

// Old URLs must be corrected explicitly: guessing a view can expose notes or
// put the wrong window on the projector. Never include credentials in errors.
export function validatePageUrl(url) {
  const replacements = []
  const corrected = new URL(url)
  if (url.searchParams.has('v')) {
    corrected.searchParams.set('view', OLD_VIEWS[url.searchParams.get('v')] ?? url.searchParams.get('v'))
    corrected.searchParams.delete('v')
    replacements.push('v → view')
  }
  if (corrected.searchParams.get('view') === 'share') { corrected.searchParams.set('view', 'reader'); replacements.push('view=share → view=reader') }
  for (const [old, name] of [['design', 'theme'], ['livekey', 'serverkey']]) {
    if (url.searchParams.has(old)) {
      corrected.searchParams.set(name, url.searchParams.get(old)); corrected.searchParams.delete(old)
      replacements.push(`${old} → ${name}`)
    }
  }
  for (const secret of ['serverkey', 'livekey', 'pair']) corrected.searchParams.delete(secret)
  if (replacements.length) return { message: `This URL uses settings from before API 2.0: ${replacements.join(', ')}. Open the updated address below. If you supplied a server key, add it again as ?serverkey=… on your own computer.`, corrected: corrected.href }
  const view = url.searchParams.get('view')
  if (view !== null && !VIEWS.has(view)) return { message: `Unknown view "${view}". Choose deck, reader, presenter or audience.` }
  return null
}

export function readerLink(address, slideId) {
  const url = new URL(address)
  for (const name of ['v', 'serverkey', 'livekey', 'pair', 'session', 'embedded', 'draw']) url.searchParams.delete(name)
  url.searchParams.set('view', 'reader')
  url.hash = encodeURIComponent(slideId)
  return url.href
}
