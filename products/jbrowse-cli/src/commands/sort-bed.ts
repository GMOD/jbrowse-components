import { parseArgs } from 'util'

import { printHelp } from '../utils'
import {
  SORT_BED_DESCRIPTION,
  SORT_BED_EXAMPLES,
} from './sort-bed-utils/constants'
import {
  handleProcessError,
  waitForProcessClose,
} from './sort-bed-utils/process-utils'
import { spawnSortProcess } from './sort-bed-utils/sort-utils'
import {
  validateFileArgument,
  validateRequiredCommands,
} from './sort-bed-utils/validators'

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

  const description = SORT_BED_DESCRIPTION
  const examples = SORT_BED_EXAMPLES

  if (flags.help) {
    printHelp({
      description,
      examples,
      usage: 'jbrowse sort-bed <file> [options]',
      options,
    })
    return
  }

  const file = positionals[0]!
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
