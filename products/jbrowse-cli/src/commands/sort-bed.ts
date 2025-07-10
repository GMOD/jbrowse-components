import { parseArgs } from 'util'

import NativeCommand, { printHelp } from '../native-base'
import {
  validateFileArgument,
  validateRequiredCommands,
} from './sort-bed-utils/validators'
import { spawnSortProcess } from './sort-bed-utils/sort-utils'
import {
  waitForProcessClose,
  handleProcessError,
} from './sort-bed-utils/process-utils'
import {
  SORT_BED_DESCRIPTION,
  SORT_BED_EXAMPLES,
} from './sort-bed-utils/constants'

export default class SortBedNative extends NativeCommand {
  static description = SORT_BED_DESCRIPTION
  static examples = SORT_BED_EXAMPLES

  async run(args?: string[]) {
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
        description: SortBedNative.description,
        examples: SortBedNative.examples,
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
}
