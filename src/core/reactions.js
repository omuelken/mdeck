// Reactions: people tap an emoji on the answer page, and it floats up on the
// presenter's screen for a moment, never on the projector. A deck turns them
// on with `reactions: true` (the set below) or its own list of up to eight,
// such as `reactions: [👍, 🤔, 🐢]`. They go to the session's `reactions`
// room, which the server passes on without keeping (src/live/rooms.js).

export const REACTIONS_ROOM = 'reactions'
// Only reactions that read one way; a deck can add its own, such as 🐢 or "slower".
export const DEFAULT_REACTIONS = ['👍', '👏', '❤️', '😮', '🤔']
const MAX = 8
const MAX_LENGTH = 16

/** Whether `value` is a usable `reactions` setting; a problem as text, or null. */
export function reactionsProblem(value) {
  if (value == null || typeof value === 'boolean') return null
  if (!Array.isArray(value) || !value.length || value.length > MAX) return `reactions must be true, false, or a list of 1 to ${MAX} emoji or short words`
  const bad = value.find(item => typeof item !== 'string' && typeof item !== 'number' || !String(item).trim() || String(item).trim().length > MAX_LENGTH)
  return bad !== undefined ? `reactions: each one is an emoji or a word of up to ${MAX_LENGTH} characters, not ${JSON.stringify(bad)}` : null
}

/** The reactions a deck offers, or null when it offers none. */
export function reactionsOf(config) {
  const value = config?.reactions
  if (value === true) return DEFAULT_REACTIONS
  if (reactionsProblem(value) || !Array.isArray(value)) return null
  return [...new Set(value.map(item => String(item).trim()))]
}
