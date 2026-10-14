// mdeck migrate: updates a deck from before 2.0.
import { basename, relative } from 'path'
import { migrateDeck } from '../migrate.js'
import { ok, err, tip } from '../ui.js'

export default async function migrate({ hasFlag, requireInput }) {
  try {
    const changes = migrateDeck(requireInput('migrate'), { dryRun: hasFlag('--dry-run') })
    for (const change of changes) ok(`${hasFlag('--dry-run') ? 'Would update' : 'Updated'} ${relative(process.cwd(), change.file)}${change.to ? ` → ${basename(change.to)}` : ''}`)
    if (!changes.length) ok('Already uses API 2.0.')
    else if (hasFlag('--dry-run')) tip('No files changed. Run without --dry-run to apply these changes.')
  } catch (error) { err(error.message); process.exitCode = 1 }
}
