import { parseArgs } from 'node:util'

import { printHelp } from '../../utils.ts'
import { describeExit, waitForProcessClose } from '../process-utils.ts'
import {
  validateFileArgument,
  validateRequiredCommands,
} from '../shared/validators.ts'
import {
  DEFAULT_BGZIP_THREADS,
  DEFAULT_COARSE_GAP,
  createPIF,
  getOutputFilename,
  missingPairs,
  spawnSortProcess,
} from './pif-generator.ts'

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
        'Accuracy bound (bp) of the coarse tier. A coarse row replaces its CIGAR with a coarse CIGAR (cr:Z:) that keeps every indel longer than half this length and folds the rest into runs, each run staying within this many bp of the real alignment. Defaults to 10000. The coarse tier (prefix T/Q) is emitted alongside the per-row CIGAR fine tier by default so whole-genome synteny views can auto-switch to it; pass --no-coarse to omit it.',
    },
    'no-coarse': {
      type: 'boolean',
      description:
        'Do not emit the coarse tier; write only the per-row CIGAR fine tier.',
    },
    threads: {
      type: 'string',
      description:
        'Compression threads for bgzip. Defaults to 4. Raise it on a machine with cores to spare, or set 1 to leave the rest of the machine alone.',
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
    '# a looser coarse tier: runs within 50kb of the alignment, indels over 25kb kept',
    '$ jbrowse make-pif input.paf --coarse 50000',
    '',
    '# emit only the per-row CIGAR fine tier, skipping the coarse tier',
    '$ jbrowse make-pif input.paf --no-coarse',
    '',
    '# give bgzip more (or fewer) compression threads than the default 4',
    '$ jbrowse make-pif input.paf --threads 8',
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

  const {
    out,
    csi = false,
    coarse,
    'no-coarse': noCoarse = false,
    threads,
  } = flags
  const outputFile = getOutputFilename(file, out)
  // --no-coarse used to silently win over an explicit --coarse, so a run asking
  // for both wrote a file with no coarse tier and said nothing about it
  if (noCoarse && coarse !== undefined) {
    throw new Error('--coarse and --no-coarse are mutually exclusive')
  }
  const coarseGap = noCoarse
    ? undefined
    : coarse === undefined
      ? DEFAULT_COARSE_GAP
      : +coarse
  // positive, never 0: a coarse row without a fold means "one run within the
  // bound", and a tier with no bound would be indistinguishable from one
  if (
    coarseGap !== undefined &&
    (!Number.isFinite(coarseGap) || coarseGap <= 0)
  ) {
    throw new Error(
      `Invalid --coarse value: ${coarse} (must be a positive number of bp)`,
    )
  }

  const bgzipThreads = threads === undefined ? DEFAULT_BGZIP_THREADS : +threads
  if (!Number.isInteger(bgzipThreads) || bgzipThreads < 1) {
    throw new Error(`Invalid --threads value: ${threads}`)
  }

  const child = spawnSortProcess(outputFile, csi, bgzipThreads)
  const stdin = child.stdin
  // end stdin even if createPIF throws, otherwise the spawned sort/index child
  // is left running with an open stdin
  const stats = await createPIF(file, stdin, coarseGap).finally(() => {
    stdin.end()
  })
  const { samples, rows, skipped } = stats
  // no SIGPIPE exemption here (unlike sort-gff/sort-bed): this pipeline's output
  // is the .pif.gz file, so anything that killed it early left that file broken
  const exit = await waitForProcessClose(child)
  if (exit.code !== 0) {
    throw new Error(`PIF sort/index pipeline exited with ${describeExit(exit)}`)
  }

  // A file that yielded nothing is almost always the wrong file, not an empty
  // alignment: without this the command wrote a valid, indexed, empty PIF and
  // printed the add-track suggestion for it
  if (rows === 0) {
    throw new Error(
      `No valid PAF rows found in ${file ?? 'stdin'} (${skipped} line(s) had fewer than the 12 mandatory PAF columns). Is this a PAF file?`,
    )
  }
  if (skipped > 0) {
    console.warn(
      `Warning: skipped ${skipped} of ${rows + skipped} line(s) with fewer than the 12 mandatory PAF columns`,
    )
  }

  // An all-vs-all PAF that does not state every pair indexes perfectly well and
  // then draws an empty synteny band for each pair the aligner never emitted,
  // which reads as "no homology here" rather than as "never computed". This is
  // the moment someone is looking at the file, and the census it needs was
  // already taken on the pass above.
  const missing = missingPairs(stats)
  if (missing.length > 0) {
    const shown = missing
      .slice(0, 5)
      .map(([a, b]) => `${a}<->${b}`)
      .join(', ')
    const rest = missing.length - Math.min(missing.length, 5)
    console.warn(
      `Warning: this file has ${samples.size} samples but states only ` +
        `${(samples.size * (samples.size - 1)) / 2 - missing.length} of their ` +
        `${(samples.size * (samples.size - 1)) / 2} pairs. Synteny bands for the ` +
        `missing pairs (${shown}${rest > 0 ? `, and ${rest} more` : ''}) will draw ` +
        `empty. That is what a reference-anchored alignment looks like — only ` +
        `pairs involving the reference are stated. Order the synteny rows so the ` +
        `reference sits between the others, use a complete all-vs-all if the ` +
        `project publishes one, or view a larger cohort as a multiple alignment ` +
        `(MAF) rather than a stack of pairwise bands.`,
    )
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
