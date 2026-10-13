// The addresses at which other devices reach `mdeck run --network`, as they
// are now. Vite works them out once, when the server starts; a laptop that
// moves to another network meanwhile would show an iPad a pairing code, and
// phones a join link, for an address it no longer has.
import { networkInterfaces } from 'node:os'

// Addresses no other device reaches: link-local ones (169.254.x.x, such as
// the cable link to an iPad, which its browser cannot use) and the IPv4
// address of a network that has only IPv6 (192.0.0.x).
const unreachable = address => address.startsWith('169.254.') || address.startsWith('192.0.0.')

/**
 * The server's `resolvedUrls`, its network addresses read again; `exposed`
 * says whether it listens on the network at all (`--network`).
 */
export function currentUrls(server, { interfaces = networkInterfaces } = {}) {
  const urls = server.resolvedUrls
  const exposed = server.config?.server?.host === true
  if (!urls?.local?.length || !exposed) return urls ? { ...urls, exposed } : urls
  const { protocol, port } = new URL(urls.local[0])
  const base = server.config.base ?? '/'
  const network = Object.values(interfaces())
    .flat()
    .filter(detail => detail && (detail.family === 'IPv4' || detail.family === 4) && !detail.internal && !unreachable(detail.address))
    .map(detail => `${protocol}//${detail.address}:${port}${base}`)
  return { ...urls, network, exposed }
}
