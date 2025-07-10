import { parseArgs } from 'util'

import NativeCommand from '../native-base'
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
import { getHelpText } from './sort-gff-utils/help-text'

export default class SortGffNative extends NativeCommand {
  static description = SORT_GFF_DESCRIPTION
  static examples = SORT_GFF_EXAMPLES

  async run(args?: string[]) {
    const { values: flags, positionals } = parseArgs({
      args,
      options: {
        help: {
          type: 'boolean',
          short: 'h',
          default: false,
        },
      },
      allowPositionals: true,
    })

    if (flags.help) {
      this.showHelp()
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

  showHelp() {
    console.log(getHelpText())
  }
}
