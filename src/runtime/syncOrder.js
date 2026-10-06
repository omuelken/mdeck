// Orders the positions windows of one talk send each other (presenter view
// ↔ audience windows). Messages can arrive late, after the receiver has
// already moved on; a position that is older than the receiver's own last
// change must not take it back. Every change carries a counter (a Lamport
// clock): a window ignores what is older than what it has. Two changes made
// at the same moment on both sides carry the same counter; then the window
// with the larger id wins on both sides, so they end up on the same slide.
const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, '0')).join('')

export function createOrder(id = randomId()) {
  let clock = 0
  return {
    id,
    /** The stamp for a change made in this window. */
    stamp() { clock += 1; return { seq: clock, from: id } },
    /** This window's position as it is, for a window that just opened: taken unless it moved on. */
    current() { return { seq: clock, from: id, initial: true } },
    /** Whether a position from another window is newer than this one's; it is then this window's too. */
    accept(stamp) {
      // A sender without stamps (an older page) is followed as before.
      if (!Number.isInteger(stamp?.seq)) return true
      if (stamp.seq < clock) return false
      if (stamp.seq === clock && !stamp.initial && !(String(stamp.from) > id)) return false
      clock = stamp.seq
      return true
    },
  }
}
