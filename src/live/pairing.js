// The browser side of pairing with `mdeck dev` (src/build/pairing.js): a
// device that opened the launch page's QR code trades the one-time token in
// the address for a token of its own, kept in this browser for this server.
const storageKey = () => `mdeck-pair:${location.origin}`

export function pairToken() {
  try { return localStorage.getItem(storageKey()) } catch { return null }
}

/** Authorization for a paired device, or nothing. */
export const pairHeaders = (headers = {}) => { const token = pairToken(); return token ? { ...headers, Authorization: `Bearer ${token}` } : headers }

/** Claims `?pair=…` if the address has one; resolves to whether it worked. */
export async function claimPairing() {
  const url = new URL(location.href)
  const offer = url.searchParams.get('pair')
  if (!offer) return false
  // Out of the address at once, so it is not bookmarked or shown.
  url.searchParams.delete('pair')
  try { history.replaceState(history.state, '', url) } catch {}
  try {
    const response = await fetch('/__mdeck/pair/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: offer }) })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) { console.warn('mdeck: pairing failed:', body.error ?? response.status); return false }
    localStorage.setItem(storageKey(), body.token)
    return true
  } catch (error) {
    console.warn('mdeck: pairing failed:', error.message)
    return false
  }
}
