// Parse the entire command before it can start a server or change any files.
const value = 'value', flag = 'flag', optional = 'optional'
const common = { '--port': value, '--no-open': flag }
const output = { '--output': value, '-o': '--output', '--no-drawings': flag }
const commands = {
  new: { max: 0 },
  run: { ...common, '--network': flag, '--server': optional, max: 1 },
  edit: { ...common, max: 1 },
  design: { ...common, max: 1 },
  build: { ...output, '--single-file': flag, '--launchers': flag, '--reader': flag, '--notes': flag, max: 1 },
  send: { ...output, '--notes': flag, '--no-pdf': flag, max: 1 },
  pdf: { ...output, max: 1 },
  preview: { ...common, max: 1 },
  check: { '--strict': flag, max: 1 },
  list: { '--json': flag, max: 2 },
  starter: { max: 2 },
  docs: { ...common, '--build': flag, max: 1 },
  server: { '--port': value, '--host': optional, max: 0 },
  skill: { '--print': flag, '--install': 'list', '--project': flag, max: 0 },
  migrate: { '--dry-run': flag, max: 1 },
}

export function validateServerOrigin(address) {
  let url
  try { url = new URL(address) } catch {}
  if (!url || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('--server needs an http:// or https:// server origin, for example https://slides.example.org')
}

export function parseArgs(command, argv) {
  const schema = commands[command]
  if (!schema) throw new Error(`Unknown command: "${command}"`)
  const options = {}, positionals = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--') { positionals.push(...argv.slice(i + 1)); break }
    if (!arg.startsWith('-')) { positionals.push(arg); continue }
    const at = arg.indexOf('=')
    let name = at < 0 ? arg : arg.slice(0, at)
    const inline = at < 0 ? undefined : arg.slice(at + 1)
    let type = schema[name]
    if (type?.startsWith('--')) { name = type; type = schema[name] }
    if (!type) throw new Error(`Unknown option for mdeck ${command}: ${name}`)
    if (Object.hasOwn(options, name)) throw new Error(`Option ${name} was given more than once`)
    if (type === flag) {
      if (inline !== undefined) throw new Error(`${name} does not take a value`)
      options[name] = true
    } else if (type === 'list') {
      const items = inline === undefined ? [] : [inline]
      while (argv[i + 1] && !argv[i + 1].startsWith('-')) items.push(argv[++i])
      if (!items.length || items.some(item => !item)) throw new Error(`${name} needs at least one assistant`)
      options[name] = items
    } else {
      let given = inline
      const next = argv[i + 1]
      if (given === undefined && next && !next.startsWith('-') && (type === value || name === '--host' || !/\.md$/i.test(next))) given = argv[++i]
      if (given === undefined && type === optional) given = null
      else if (!given) throw new Error(`${name} needs a value`)
      options[name] = given
    }
  }
  if (positionals.length > schema.max) throw new Error(`Too many arguments for mdeck ${command}: ${positionals.slice(schema.max).join(' ')}`)
  if (options['--port'] !== undefined) {
    const port = Number(options['--port'])
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Choose a port number between 1 and 65535.')
    options['--port'] = port
  }
  if (typeof options['--server'] === 'string') {
    validateServerOrigin(options['--server'])
  }
  if (command === 'build' && options['--notes'] && !options['--reader']) throw new Error('--notes requires --reader for mdeck build')
  if (command === 'build' && options['--launchers'] && options['--single-file']) throw new Error('--launchers is only available for folders, not with --single-file.')
  if (command === 'list' && positionals.length === 2 && !['layouts', 'themes', 'palettes'].includes(positionals[0])) throw new Error('Use mdeck list [layouts|themes|palettes] [slides.md]')
  if (command === 'skill' && options['--print'] && options['--install']) throw new Error('Choose --print or --install')
  return { options, positionals }
}
