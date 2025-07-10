import { parseArgs } from 'util'

import NativeCommand, { printHelp } from '../native-base'
import {
  validateFileArgument,
  validateRequiredCommands,
} from './sort-gff-utils/validators'
import { spawnSortProcess } from './sort-gff-utils/sort-utils'
import {
  waitForProcessClose,
  handleProcessError,
} from './sort-gff-utils/process-utils'
import {
  SORT_GFF_DESCRIPTION,
  SORT_GFF_EXAMPLES,
} from './sort-gff-utils/constants'

export default class SortGffNative extends NativeCommand {
  static description = SORT_GFF_DESCRIPTION
  static examples = SORT_GFF_EXAMPLES

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
        description: SortGffNative.description,
        examples: SortGffNative.examples,
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
}
