import { parseArgs } from 'util'

import { printHelp } from '../utils'
import {
  SORT_GFF_DESCRIPTION,
  SORT_GFF_EXAMPLES,
} from './sort-gff-utils/constants'
import {
  handleProcessError,
  waitForProcessClose,
} from './sort-gff-utils/process-utils'
import { spawnSortProcess } from './sort-gff-utils/sort-utils'
import {
  validateFileArgument,
  validateRequiredCommands,
} from './sort-gff-utils/validators'

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

  const description = SORT_GFF_DESCRIPTION
  const examples = SORT_GFF_EXAMPLES

  if (flags.help) {
    printHelp({
      description,
      examples,
      usage: 'jbrowse sort-gff <file> [options]',
      options,
    })
    return
  }

  const file = positionals[0]
  validateFileArgument(file)
  validateRequiredCommands()

  try {
    const child = spawnSortProcess({ file })
    const exitCode = await waitForProcessClose(child)

    if (exitCode !== 0) {
      console.error(`Sort process exited with code ${exitCode}`)
      process.exit(exitCode || 1)
    }
  } catch (error) {
    handleProcessError(error)
  }
}
