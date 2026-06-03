import { parseArgs } from 'util'

import {
  DEFAULT_COARSE_SPLIT_GAP,
  createPIF,
  getOutputFilename,
  spawnSortProcess,
} from './pif-generator.ts'
import { printHelp } from '../../utils.ts'
import { waitForProcessClose } from '../process-utils.ts'
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
        'Minimum insertion/deletion length (bp) at which a coarse-tier row is split into multiple pieces so each row stays tight — 0 strips CIGAR with no splitting. Defaults to 10000. The no-CIGAR coarse tier (prefix T/Q) is emitted by default so whole-genome synteny views can auto-switch to it; pass --no-coarse to omit it.',
    },
    'no-coarse': {
      type: 'boolean',
      description:
        'Do not emit the coarse no-CIGAR tier; write only the per-row CIGAR fine tier.',
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
  validateRequiredCommands(['sh', 'sort', 'tabix', 'bgzip'])

  const { out, csi = false, coarse, 'no-coarse': noCoarse = false } = flags
  const outputFile = getOutputFilename(file, out)
  let coarseSplitGap: number | undefined
  if (noCoarse) {
    coarseSplitGap = undefined
  } else {
    coarseSplitGap = coarse === undefined ? DEFAULT_COARSE_SPLIT_GAP : +coarse
  }
  if (
    coarseSplitGap !== undefined &&
    (!Number.isFinite(coarseSplitGap) || coarseSplitGap < 0)
  ) {
    throw new Error(`Invalid --coarse value: ${coarse}`)
  }

  const child = spawnSortProcess(outputFile, csi)
  const stdin = child.stdin
  await createPIF(file, stdin, coarseSplitGap)
  stdin.end()
  const exitCode = await waitForProcessClose(child)
  if (exitCode !== 0) {
    throw new Error(`PIF sort/index pipeline exited with code ${exitCode}`)
  }
}
