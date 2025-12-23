import { parseArgs } from 'util'

import { printHelp } from '../utils'
import { waitForProcessClose } from './process-utils'
import { GFF_CONFIG, spawnSortProcess } from './shared/sort-utils'
import { validateFileArgument, validateRequiredCommands } from './shared/validators'

export async function run(args?: string[]) {
  const options = {
    help: {
      type: 'boolean',
      short: 'h',
    },
  } as const
  const { values: flags, positionals } = parseArgs({
    args,
    options,
    allowPositionals: true,
  })

  if (flags.help) {
    printHelp({
      description: GFF_CONFIG.description,
      examples: GFF_CONFIG.examples,
      usage: 'jbrowse sort-gff [file] [options]',
      options,
    })
    return
  }

  const file = positionals[0]
  validateFileArgument(file, 'sort-gff', 'gff')
  validateRequiredCommands(['sh', 'sort', 'grep'])

  const child = spawnSortProcess(file, GFF_CONFIG.sortColumn)
  const exitCode = await waitForProcessClose(child)

  if (exitCode !== 0) {
    throw new Error(`Sort process exited with code ${exitCode}`)
  }
}
