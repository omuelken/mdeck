// mdeck snapshot: pictures of slides as PNG files.
import { resolve, dirname, relative } from 'path'
import { parseSlideNumbers } from '../args.js'
import { err } from '../ui.js'

export default async function takeSnapshots({ options, hasFlag, outputOption, requireInput }) {
  const input = requireInput('snapshot')
  try {
    const slides = parseSlideNumbers(options['--slide'] ?? '')
    const outDir = resolve(outputOption() ?? resolve(dirname(resolve(input)), '.mdeck-snapshots'))
    const appearance = hasFlag('--dark') ? 'dark' : hasFlag('--light') ? 'light' : ''
    const { snapshot } = await import('../../build/renderCheck.js')
    for (const file of await snapshot(input, { slides, outDir, appearance, sheet: hasFlag('--sheet') })) console.log(relative(process.cwd(), file))
  } catch (error) { err(error.message); process.exitCode = 1 }
}
