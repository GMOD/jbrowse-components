import { parseArgs } from 'util'

import {
  createPIF,
  getOutputFilename,
  spawnSortProcess,
  waitForProcessClose,
} from './pif-generator.ts'
import { printHelp } from '../../utils.ts'
import {
  validateFileArgument,
  validateRequiredCommands,
} from '../shared/validators.ts'

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
    mergeGap: {
      type: 'string',
      description:
        'If >0, also emit a no-CIGAR coarse tier of merged alignment blocks (prefix T/Q). Records within this many bp on the target are merged. 0 disables. Default 0.',
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
  validateFileArgument(file, 'make-pif', 'paf')
  validateRequiredCommands(['sh', 'sort', 'grep', 'tabix', 'bgzip'])

  const { out, csi = false, mergeGap } = flags
  const outputFile = getOutputFilename(file, out)
  const mergeGapNum = mergeGap === undefined ? 0 : +mergeGap
  if (!Number.isFinite(mergeGapNum) || mergeGapNum < 0) {
    throw new Error(`Invalid --mergeGap value: ${mergeGap}`)
  }

  const child = spawnSortProcess(outputFile, csi)
  await createPIF(file, child.stdin, mergeGapNum)
  child.stdin.end()
  await waitForProcessClose(child)
}
