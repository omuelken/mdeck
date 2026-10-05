// Pairing another device (an iPad) with `mdeck run`, so it may do what only
// this computer may: save ink and steer the rooms. The launch page, which
// only answers on this computer, offers a one-time address as a QR code; the
// device trades the one-time token in it for a token of its own, which it
// sends as `Authorization: Bearer …`. Tokens live in memory: restarting
// `mdeck run` or "Unpair" on the launch page ends every pairing.
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { send, readJson } from './editorPlugin.js'

const OFFER_MS = 10 * 60 * 1000
const token = () => randomBytes(24).toString('base64url')
const same = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y) }

export function createPairing({ now = Date.now } = {}) {
  const offers = new Map() // one-time token → expiry
  const devices = new Set()
  const listeners = new Set()
  const changed = () => { for (const listener of listeners) listener() }
  const bearer = request => (request.headers?.authorization ?? '').replace(/^Bearer\s+/i, '')

  return {
    /** A one-time token for the QR code, valid for ten minutes. */
    offer() {
      for (const [offer, expires] of offers) if (expires < now()) offers.delete(offer)
      const offer = token()
      offers.set(offer, now() + OFFER_MS)
      return offer
    },
    /** The device's own token for a one-time token, or null. */
    claim(offer) {
      if (typeof offer !== 'string') return null
      for (const [known, expires] of offers) {
        if (!same(known, offer)) continue
        offers.delete(known)
        if (expires < now()) return null
        const device = token()
        devices.add(device)
        changed()
        return device
      }
      return null
    },
    /** Whether a request comes from a paired device. */
    allows(request) {
      const given = bearer(request)
      if (!given) return false
      for (const device of devices) if (same(device, given)) return true
      return false
    },
    revoke() { devices.clear(); offers.clear(); changed() },
    /** The paired devices' tokens, for the room server of `mdeck run --share`. */
    tokens: () => [...devices],
    /** Calls back when a device pairs or all are unpaired; returns a function that stops it. */
    onChange(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    get devices() { return devices.size },
  }
}

// POST /claim { token } → { token }: open to the network, like the page the
// QR code leads to; everything else about pairing is on the launch page.
export function pairingMiddleware(pairing) {
  return async (request, response, next) => {
    const { pathname } = new URL(request.url, 'http://localhost')
    if (pathname !== '/claim') return next()
    if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); return send(response, 405, { error: 'Method not allowed' }) }
    try {
      const device = pairing.claim((await readJson(request))?.token)
      if (!device) return send(response, 403, { error: 'This pairing code was used or is too old; show a new one on the launch page' })
      return send(response, 200, { token: device })
    } catch (error) {
      return send(response, error.status ?? 500, { error: error.message })
    }
  }
}

export function pairingPlugin(pairing) {
  return {
    name: 'vite-plugin-mdeck-pairing',
    configureServer(server) { server.middlewares.use('/__mdeck/pair', pairingMiddleware(pairing)) },
  }
}
