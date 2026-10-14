// ── ANSI helpers ──────────────────────────────────────────────────────────────
const tty = process.stdout.isTTY
export const c = tty
  ? { reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', green: '\x1b[32m', cyan: '\x1b[36m', yellow: '\x1b[33m', red: '\x1b[31m' }
  : Object.fromEntries(['reset','bold','dim','green','cyan','yellow','red'].map(k => [k, '']))

export const ok  = msg => console.log(`  ${c.green}✓${c.reset}  ${msg}`)
export const err = msg => console.error(`  ${c.red}✗${c.reset}  ${msg}`)
export const tip = msg => console.log(`  ${c.dim}${msg}${c.reset}`)
