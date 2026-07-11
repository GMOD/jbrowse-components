import { parseArgs } from 'node:util'

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
    '# creates input.pif.gz and input.pif.gz.tbi in the same directory',
    '$ jbrowse make-pif input.paf',
    '',
    '# specify the output file, also creates output.pif.gz.tbi',
    '$ jbrowse make-pif input.paf --out output.pif.gz',
    '',
    '# use a CSI index for assemblies with chromosomes longer than ~512 Mb',
    '$ jbrowse make-pif input.paf --csi',
    '',
    '# strip CIGAR and emit only the coarse whole-genome tier',
    '$ jbrowse make-pif input.paf --coarse 0',
    '',
    '# emit only the per-row CIGAR fine tier, skipping the coarse tier',
    '$ jbrowse make-pif input.paf --no-coarse',
  ]

  const notes =
    'Use --csi for assemblies containing sequences longer than ~512 Mb. The ' +
    'default TBI index cannot address coordinates beyond 2^29 (~536 Mb), so a ' +
    'CSI index is required for large chromosomes (e.g. some plant and ' +
    'amphibian genomes). Requires sh, sort, bgzip, and tabix on the PATH.'

  if (flags.help) {
    printHelp({
      description,
      examples,
      notes,
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
  // end stdin even if createPIF throws, otherwise the spawned sort/index child
  // is left running with an open stdin
  const { samples } = await createPIF(file, stdin, coarseSplitGap).finally(() => {
    stdin.end()
  })
  const exitCode = await waitForProcessClose(child)
  if (exitCode !== 0) {
    throw new Error(`PIF sort/index pipeline exited with code ${exitCode}`)
  }

  const indexFile = `${outputFile}.${csi ? 'csi' : 'tbi'}`
  const nextCommand =
    samples.size > 0
      ? 'Next, add it as an all-vs-all synteny track (PanSN names detected):\n' +
        `  jbrowse add-track ${outputFile} --adapterType AllVsAllIndexedPAFAdapter -a ${[...samples].sort().join(',')} --load copy`
      : 'Next, add it as a synteny track (set -a to your query,target assembly names):\n' +
        `  jbrowse add-track ${outputFile} -a query,target --load copy`
  console.log(`Created ${outputFile} and ${indexFile}\n\n${nextCommand}`)
}
