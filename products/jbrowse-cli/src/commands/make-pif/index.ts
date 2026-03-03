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
    'split-threshold': {
      type: 'string',
      description:
        'Split alignments at indels larger than this threshold (in bp). Set to 0 to disable splitting.',
      default: '10000',
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

  const { out, csi = false } = flags
  const splitThreshold = Number(flags['split-threshold'] ?? '10000')
  const outputFile = getOutputFilename(file, out)

  const child = spawnSortProcess(outputFile, csi)
  await createPIF(file, child.stdin, splitThreshold)
  child.stdin.end()
  await waitForProcessClose(child)
}
