import { parseArgs } from 'util'

import { printHelp } from '../utils.ts'
import { waitForProcessClose } from './process-utils.ts'
import { BED_CONFIG, spawnSortProcess } from './shared/sort-utils.ts'
import {
  validateFileArgument,
  validateRequiredCommands,
} from './shared/validators.ts'

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
      description: BED_CONFIG.description,
      examples: BED_CONFIG.examples,
      usage: 'jbrowse sort-bed [file] [options]',
      options,
    })
    return
  }

  const file = positionals[0]
  validateFileArgument(file, 'sort-bed', 'bed')
  validateRequiredCommands(['sh', 'sort', 'grep'])

  const child = spawnSortProcess(file, BED_CONFIG.sortColumn)
  const exitCode = await waitForProcessClose(child)

  if (exitCode !== 0) {
    throw new Error(`Sort process exited with code ${exitCode}`)
  }
}
