import { createWriteStream } from 'node:fs'
import { parseArgs } from 'node:util'

import { printHelp } from '../../utils.ts'
import { validateFileArgument } from '../shared/validators.ts'
import { composeLegs } from './join.ts'
import { forEachPafRow, formatPafRow, panSNSample } from './paf.ts'
import {
  censusRow,
  emptyCensus,
  legKey,
  neededLegs,
  planCompositions,
} from './plan.ts'

import type { PafRow } from './paf.ts'
import type { Writable } from 'node:stream'

const DEFAULT_MIN_LENGTH = 5000

// Diagnostics go to stderr unconditionally, because the PAF itself goes to
// stdout when --out is absent — the shape that lets this pipe straight into
// make-pif.
function report(message: string) {
  console.error(message)
}

function write(stream: Writable, text: string) {
  return stream.write(text)
    ? undefined
    : new Promise<void>(resolve => {
        stream.once('drain', () => {
          resolve()
        })
      })
}

export async function run(args?: string[]) {
  const options = {
    help: {
      type: 'boolean',
      short: 'h',
    },
    out: {
      type: 'string',
      description:
        'Where to write the PAF. Writes to stdout when omitted, so this can pipe straight into make-pif. Progress and the summary always go to stderr.',
    },
    via: {
      type: 'string',
      description:
        'Route every composition through this PanSN sample. Defaults to choosing, per missing pair, whichever sample has the most alignments to both ends of it.',
    },
    'min-length': {
      type: 'string',
      description: `Discard a composed alignment carrying fewer than this many aligned bases. Composition through an intermediate turns two alignments into their intersection, which produces a long tail of tiny fragments; this is the control on how much of that tail is kept. Defaults to ${DEFAULT_MIN_LENGTH}.`,
    },
    'only-composed': {
      type: 'boolean',
      description:
        'Write only the composed alignments, not the input rows. The default writes the input through first, so the output is a complete all-vs-all PAF ready for make-pif.',
    },
  } as const
  const { values: flags, positionals } = parseArgs({
    args,
    options,
    allowPositionals: true,
  })

  const description =
    'Fill in the pairwise alignments an all-vs-all PAF is missing, by composing through a shared intermediate'

  const examples = [
    '# add every missing pair, then index the result',
    '$ jbrowse transitive-paf all_vs_all.paf --out complete.paf',
    '$ jbrowse make-pif complete.paf',
    '',
    '# or pipe it straight through',
    '$ jbrowse transitive-paf all_vs_all.paf | jbrowse make-pif --out complete.pif.gz',
    '',
    '# a star-topology mapping: everything was aligned to GRCh38, nothing to each other',
    '$ jbrowse transitive-paf vs_ref.paf --via GRCh38 --out complete.paf',
    '',
    '# keep more of the short tail',
    '$ jbrowse transitive-paf all_vs_all.paf --min-length 1000 --out complete.paf',
  ]

  const notes =
    'An "all-vs-all" PAF frequently is not one. wfmash with a -p threshold drops ' +
    'distant pairs, and many real files are a star: every sample aligned to one ' +
    'reference and to nothing else. JBrowse loads those without complaint and ' +
    'then draws an empty synteny band for any pair the aligner never emitted, ' +
    'which looks exactly like a locus with no homology. This composes A-vs-R and ' +
    'B-vs-R into the A-vs-B they imply, for every sample pair the file does not ' +
    'state directly.\n\n' +
    'A composed row is derived, not measured. Its identity is the product of the ' +
    'two input identities (no sequence is available to recompute it), and it ' +
    'carries a vi:Z: tag naming the pivot contig it was routed through, so a ' +
    'composed alignment is always distinguishable from an aligned one. Sequence ' +
    'names must be PanSN-prefixed (sample#haplotype#contig) — that is what says ' +
    'which assembly each side belongs to — and rows without a CIGAR are skipped, ' +
    'since there is no way to know which bases of the pivot they pair with.'

  if (flags.help) {
    printHelp({
      description,
      examples,
      notes,
      usage: 'jbrowse transitive-paf <file> [options]',
      options,
    })
    return
  }

  const file = positionals[0]
  // Unlike make-pif this cannot read stdin: it makes two passes over the file
  // (census, then load only the rows the plan needs), and buffering a whole
  // pangenome PAF to avoid the second pass is the memory this is avoiding.
  if (!file) {
    throw new Error(
      'Missing required argument: file\n' +
        'Usage: jbrowse transitive-paf <file>\n' +
        'This command reads the file twice, so it cannot take input on stdin.',
    )
  }
  validateFileArgument(file, 'transitive-paf', 'paf')

  const minAligned =
    flags['min-length'] === undefined
      ? DEFAULT_MIN_LENGTH
      : +flags['min-length']
  if (!Number.isFinite(minAligned) || minAligned < 0) {
    throw new Error(`Invalid --min-length value: ${flags['min-length']}`)
  }

  report(`Pass 1/2: reading ${file}`)
  const census = emptyCensus()
  await forEachPafRow(file, row => {
    censusRow(census, row)
  })
  if (census.rows === 0) {
    throw new Error(
      `No usable PAF rows found in ${file}. Rows need the 12 mandatory columns and a cg:Z:/cs:Z: alignment string — a PAF written without --cs or -c cannot be composed through.`,
    )
  }
  // Without a separator anywhere, every contig is its own "sample", so a plain
  // pairwise PAF would sail past the checks and be reported as a file that
  // already states every pair — which is true and useless. Named as its own
  // mistake, the way the adapter's noPanSNMatchError does.
  if (!census.anyPanSN) {
    throw new Error(
      `No sequence name in ${file} carries a PanSN sample prefix (e.g. "${[...census.samples][0]}" rather than "sample#1#${[...census.samples][0]}"), so there is no way to tell which assembly each side of an alignment belongs to. Composition is only meaningful across assemblies; rewrite the names as sample#haplotype#contig.`,
    )
  }
  if (census.samples.size < 2) {
    throw new Error(
      `Only one sample found in ${file} ("${[...census.samples][0]}"). There is no pair to compose.`,
    )
  }
  if (flags.via !== undefined && !census.samples.has(flags.via)) {
    throw new Error(
      `--via "${flags.via}" is not a sample in ${file}. Its samples are: ${[...census.samples].sort().join(', ')}.`,
    )
  }

  const tasks = planCompositions(census, flags.via)
  report(
    `Found ${census.rows} alignments over ${census.samples.size} samples; ${tasks.length} sample pair(s) to compose`,
  )

  const legs = neededLegs(tasks)
  const rowsByLeg = new Map<string, PafRow[]>()
  if (tasks.length > 0) {
    report('Pass 2/2: loading the alignments those pairs route through')
  }

  const out = flags.out ? createWriteStream(flags.out) : process.stdout
  let written = 0
  const emit = async (row: PafRow) => {
    written++
    await write(out, formatPafRow(row))
  }

  // Second pass: pass the input through (unless suppressed) while keeping only
  // the rows some task needs. Doing both here means the file is read twice
  // total, not three times.
  await forEachPafRow(file, async row => {
    const key = legKey(panSNSample(row.qname), panSNSample(row.tname))
    if (legs.has(key)) {
      const bucket = rowsByLeg.get(key)
      if (bucket) {
        bucket.push(row)
      } else {
        rowsByLeg.set(key, [row])
      }
    }
    if (!flags['only-composed']) {
      await emit(row)
    }
  })

  for (const task of tasks) {
    const n = await composeLegs({
      task,
      legA: rowsByLeg.get(legKey(task.a, task.via)) ?? [],
      legB: rowsByLeg.get(legKey(task.b, task.via)) ?? [],
      minAligned,
      emit,
    })
    report(
      `  ${task.a} <-> ${task.b} via ${task.via}: ${n} composed alignment(s)`,
    )
  }

  if (flags.out) {
    await new Promise<void>((resolve, reject) => {
      out.end(() => {
        resolve()
      })
      out.on('error', reject)
    })
  }

  const where = flags.out ?? 'stdout'
  if (tasks.length === 0) {
    report(
      `Every sample pair in ${file} already has direct alignments — nothing to compose. Wrote ${written} row(s) to ${where}.`,
    )
    return
  }
  report(`Wrote ${written} row(s) to ${where}.`)
  if (flags.out) {
    report(
      `\nNext, index it:\n  jbrowse make-pif ${flags.out}\n` +
        `and add it with -a ${[...census.samples].sort().join(',')}`,
    )
  }
}
