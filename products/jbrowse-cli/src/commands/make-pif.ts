import { parseArgs } from 'util'

import { printHelp } from '../utils'
import {
  createPIF,
  getOutputFilename,
  spawnSortProcess,
  waitForProcessClose,
} from './make-pif-utils/pif-generator'
import {
  validateFileArgument,
  validateRequiredCommands,
} from './make-pif-utils/validators'

export async function run(args?: string[]) {
  const options = {
    help: {
      type: 'boolean',
      short: 'h',
    },
    out: {
      type: 'string',
      description:
        'Where to write the output file. will write ${file}.pif.gz and ${file}.pif.gz.tbi',
    },
    csi: {
      type: 'boolean',
      description: 'Create a CSI index for the PIF file instead of TBI',
    },
  } as const
  const { values: flags, positionals } = parseArgs({
    args,
    options,
    allowPositionals: true,
  })

  const description = 'creates pairwise indexed PAF (PIF), with bgzip and tabix'

  const examples = [
    '$ jbrowse make-pif input.paf # creates input.pif.gz in same directory',
    '',
    '$ jbrowse make-pif input.paf --out output.pif.gz # specify output file, creates output.pif.gz.tbi also',
  ]

  if (flags.help) {
    printHelp({
      description,
      examples,
      usage: 'jbrowse make-pif <file> [options]',
      options,
    })
    return
  }

  const file = positionals[0]
  validateFileArgument(file)
  validateRequiredCommands()

  const { out, csi = false } = flags
  const outputFile = getOutputFilename(file, out)

  try {
    const child = spawnSortProcess(outputFile, csi)
    await createPIF(file, child.stdin)
    child.stdin.end()
    await waitForProcessClose(child)
  } catch (error) {
    console.error('Error during PIF creation:', error)
    process.exit(1)
  }
}
