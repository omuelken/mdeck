// mdeck themes and mdeck palettes: find, install, update or remove them.
import { runPackages } from '../themes.js'
import { c, ok, err, tip } from '../ui.js'

export default async function packages({ command, positionals, hasFlag, outputOption }) {
  await runPackages({ kind: command.slice(0, -1), positionals: positionals(), flag: name => hasFlag(name), output: outputOption, ui: { ok, err, tip, c } })
}
