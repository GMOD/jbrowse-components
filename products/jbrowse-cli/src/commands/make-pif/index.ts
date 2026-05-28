import { parseArgs } from 'util'

import {
  createPIF,
  getOutputFilename,
  spawnSortProcess,
} from './pif-generator.ts'
import { waitForProcessClose } from '../process-utils.ts'
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
    coarse: {
      type: 'string',
      description:
        'If set, also emit a no-CIGAR coarse tier (prefix T/Q) of the same alignment rows with CIGAR stripped. The value is the minimum insertion/deletion length (bp) at which a row is split into multiple pieces — 0 emits one coarse row per fine row (strip only, no splitting). Default: coarse tier is not emitted.',
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

  const { out, csi = false, coarse } = flags
  const outputFile = getOutputFilename(file, out)
  const coarseSplitGap = coarse === undefined ? undefined : +coarse
  if (
    coarseSplitGap !== undefined &&
    (!Number.isFinite(coarseSplitGap) || coarseSplitGap < 0)
  ) {
    throw new Error(`Invalid --coarse value: ${coarse}`)
  }

  const child = spawnSortProcess(outputFile, csi)
  const stdin = child.stdin!
  await createPIF(file, stdin, coarseSplitGap)
  stdin.end()
  const exitCode = await waitForProcessClose(child)
  if (exitCode !== 0) {
    throw new Error(`PIF sort/index pipeline exited with code ${exitCode}`)
  }
}
