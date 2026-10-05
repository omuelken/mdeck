// A deck's session code: six digits that name its rooms on the room server
// and end its join link (`<server>/482113`). It is derived from the deck, so
// the presenter's screen, the QR code on the slides and the launch page agree
// without asking the server. `live.code` sets it; otherwise `live.id` or the
// title picks it.

export const slug = text => String(text ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)

export const CODE_RE = /^\d{4,8}$/

export function sessionCode(deckConfig = {}) {
  const session = deckConfig.session ?? {}
  if (session.code != null && CODE_RE.test(String(session.code))) return String(session.code)
  const name = slug(session.id ?? deckConfig.meta?.title) || 'deck'
  // FNV-1a, then six digits that never start with 0.
  let hash = 0x811c9dc5
  for (const char of name) hash = Math.imul(hash ^ char.codePointAt(0), 0x01000193) >>> 0
  return String(100000 + (hash % 900000))
}
