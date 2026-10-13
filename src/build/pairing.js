// Pairing another device (an iPad) with `mdeck run`, so it may do what only
// this computer may: save ink and steer the rooms. The launch page, which
// only answers on this computer, offers a one-time address as a QR code; the
// device trades the one-time token in it for a token of its own, which it
// sends as `Authorization: Bearer …`. With a `store` the tokens are kept in
// a file only this user may read, so that a restart of `mdeck run` (or of
// the computer) does not end the pairing in the middle of a talk; a device
// unused for 30 days is forgotten. "Unpair" on the launch page ends every
// pairing. `mdeck run` keeps one file per deck (pairingStoreFor).
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync, unlinkSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { send, readJson } from './editorPlugin.js'
import { mdeckHome } from '../extensions/discover.js'

const OFFER_MS = 10 * 60 * 1000
const FORGET_MS = 30 * 24 * 60 * 60 * 1000
// How often a device's last use is written down.
const USED_MS = 60 * 60 * 1000
const token = () => randomBytes(24).toString('base64url')
const same = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y) }

/** Where `mdeck run` keeps the paired devices of a deck: in mdeck's own folder (~/.mdeck), not beside the deck. */
export function pairingStoreFor(deckPath, { home = mdeckHome() } = {}) {
  const deck = createHash('sha256').update(resolve(deckPath)).digest('hex').slice(0, 16)
  return resolve(home, 'paired', `${deck}.json`)
}

export function createPairing({ now = Date.now, store = null } = {}) {
  const offers = new Map() // one-time token → expiry
  const devices = new Set()
  const used = new Map() // device token → last use
  const listeners = new Set()
  const changed = () => { for (const listener of listeners) listener() }

  function save() {
    if (!store) return
    if (!devices.size) { if (existsSync(store)) unlinkSync(store); return }
    mkdirSync(dirname(store), { recursive: true, mode: 0o700 })
    const temp = `${store}.${process.pid}.tmp`
    writeFileSync(temp, JSON.stringify({ devices: [...devices].map(token => ({ token, used: used.get(token) })) }, null, 2) + '\n', { mode: 0o600 })
    renameSync(temp, store)
  }
  if (store) {
    let kept = []
    try { kept = JSON.parse(readFileSync(store, 'utf8')).devices ?? [] } catch {}
    for (const { token, used: at } of Array.isArray(kept) ? kept : []) {
      if (typeof token !== 'string' || token.length < 32 || !(now() - at < FORGET_MS)) continue
      devices.add(token)
      used.set(token, at)
    }
    try { save() } catch {}
  }
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
        used.set(device, now())
        try { save() } catch {}
        changed()
        return device
      }
      return null
    },
    /** Whether a request comes from a paired device. */
    allows(request) {
      const given = bearer(request)
      if (!given) return false
      for (const device of devices) {
        if (!same(device, given)) continue
        if (now() - used.get(device) > USED_MS) { used.set(device, now()); try { save() } catch {} }
        return true
      }
      return false
    },
    revoke() { devices.clear(); used.clear(); offers.clear(); try { save() } catch {} changed() },
    /** The paired devices' tokens, for the server of `mdeck run --server`. */
    tokens: () => [...devices],
    /** Calls back when a device pairs or all are unpaired; returns a function that stops it. */
    onChange(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    get devices() { return devices.size },
  }
}

// POST /claim { token } → { token }: open to the network, like the page the
// QR code leads to; everything else about pairing is on the launch page.
// GET /status → { paired }: whether the token this device shows still counts.
export function pairingMiddleware(pairing) {
  return async (request, response, next) => {
    const { pathname } = new URL(request.url, 'http://localhost')
    if (pathname === '/status' && request.method === 'GET') return send(response, 200, { paired: pairing.allows(request) })
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
