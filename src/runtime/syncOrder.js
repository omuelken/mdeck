// Orders the positions windows of one talk send each other (presenter view
// ↔ audience windows). Messages can arrive late, after the receiver has
// already moved on; a position that is older than the receiver's own last
// change must not take it back. Every change carries a counter (a Lamport
// clock): a window ignores what is older than what it has. Two changes made
// at the same moment on both sides carry the same counter; then the window
// with the larger id wins on both sides, so they end up on the same slide.
const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, '0')).join('')

export function createOrder(id = randomId()) {
  let latest = { seq: 0, from: id }
  return {
    id,
    /** The stamp for a change made in this window. */
    stamp() { latest = { seq: latest.seq + 1, from: id }; return { ...latest } },
    /** This window's position as it is, for a window that just opened: taken unless it moved on. */
    current() { return { ...latest, initial: true } },
    /** Whether a position from another window is newer than this one's; it is then this window's too. */
    accept(stamp) {
      // A sender without stamps (an older page) is followed as before.
      if (!Number.isInteger(stamp?.seq)) return true
      if (stamp.seq < latest.seq) return false
      // Before anyone has navigated, a new window takes the presenter's
      // initial position regardless of its own id. Once navigation starts,
      // replies and forwarded positions obey the same ordering as changes.
      const opening = latest.seq === 0 && stamp.initial
      if (stamp.seq === latest.seq && !opening && !(String(stamp.from) > latest.from)) return false
      latest = { seq: stamp.seq, from: String(stamp.from) }
      return true
    },
  }
}
