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

// Low on purpose. Composition intersects two alignments, so it always produces a
// tail of short pieces, and the instinct is to cut it hard at write time — but
// the synteny view already has its own minAlignmentLength (the E. coli demo sets
// 10 kb), and a threshold here throws information away permanently instead of
// per-view. Measured both ways: on base-level E. coli input, 1000 recovers 92.6%
// of the held-out alignment against 88.1% at 5000, precision unchanged at 99.8%.
// On segment-level input (odgi untangle, ~5 kb projections) the difference is
// 13x — 3.6 Mb of a 5 Mb genome covered instead of 271 kb.
const DEFAULT_MIN_LENGTH = 1000

// Composition multiplies coverage depth, so the output grows with the square of
// the pileup rather than with the genome. Measured on HPRC chr20 vs GRCh38:
// 4,663 input rows compose to 225,626, of which 9,084 hold essentially all the
// coverage. 0.5 and 0.95 pick nearly the same set, so this is not a tuned knob —
// anything that rejects "already covered" collapses the pileup.
const DEFAULT_MAX_COVERED = 0.5

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
      description: `Discard a composed alignment carrying fewer than this many aligned bases. Composition intersects two alignments, so it always leaves a tail of short pieces; this is the control on how much of that tail is kept. Defaults to ${DEFAULT_MIN_LENGTH}, deliberately low — the synteny view has its own minAlignmentLength, and a cut here is permanent while a cut there is per-view.`,
    },
    'max-covered': {
      type: 'string',
      description: `Drop a composed alignment when at least this fraction of its span is already covered by longer ones on the same pair. Composition multiplies coverage DEPTH: a repeat where two haplotypes each have 200 alignments on the reference composes to 40,000 rows stating one homology. On one chromosome of HPRC-vs-GRCh38 this turns 225,626 compositions into 9,084 carrying the same coverage. Set to 1 to keep every composition. Defaults to ${DEFAULT_MAX_COVERED}.`,
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
    '# cut the short tail harder (the view can also filter with minAlignmentLength)',
    '$ jbrowse transitive-paf all_vs_all.paf --min-length 10000 --out complete.paf',
  ]

  const notes =
    'An "all-vs-all" PAF frequently is not one. wfmash with a -p threshold drops ' +
    'distant pairs, and many real files are a star: every sample aligned to one ' +
    'reference and to nothing else. JBrowse loads those without complaint and ' +
    'then draws an empty synteny band for any pair the aligner never emitted, ' +
    'which looks exactly like a locus with no homology. This composes A-vs-R and ' +
    'B-vs-R into the A-vs-B they imply, for every sample pair the file does not ' +
    'state directly.\n\n' +
    'A composed row is derived, not measured, and its identity is a LOWER BOUND: ' +
    'with no sequence to recompute from it is the product of the two legs’ ' +
    'identities, which assumes they diverge from the pivot independently. Related ' +
    'genomes do not, so the truth is higher — measured on a 5-strain E. coli ' +
    'pangenome by holding out one pair and composing it back, 1.3 percentage ' +
    'points low on average, 5.1 at worst, while recovering 88% of the real ' +
    'alignment at 99.8% precision. Every composed row carries a vi:Z: tag naming ' +
    'the pivot it was routed through, so it is never mistaken for a measured one.\n\n' +
    'Sequence names must be PanSN-prefixed (sample#haplotype#contig) — that is ' +
    'what says which assembly each side belongs to. Rows carrying a CIGAR compose ' +
    'base by base; rows without one (odgi untangle projections, PIF coarse rows) ' +
    'compose to coordinates only, and the result carries no CIGAR either.'

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

  const maxCovered =
    flags['max-covered'] === undefined
      ? DEFAULT_MAX_COVERED
      : +flags['max-covered']
  if (!Number.isFinite(maxCovered) || maxCovered <= 0 || maxCovered > 1) {
    throw new Error(
      `Invalid --max-covered value: ${flags['max-covered']} (expected a fraction in (0, 1])`,
    )
  }
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
      `No usable PAF rows found in ${file}. Rows need the 12 mandatory PAF columns. Is this a PAF file?`,
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

  let discarded = 0
  for (const task of tasks) {
    const { composed, tooShort, redundant } = await composeLegs({
      task,
      legA: rowsByLeg.get(legKey(task.a, task.via)) ?? [],
      legB: rowsByLeg.get(legKey(task.b, task.via)) ?? [],
      minAligned,
      maxCovered,
      emit,
    })
    discarded += tooShort
    report(
      `  ${task.a} <-> ${task.b} via ${task.via}: ${composed} composed` +
        (redundant > 0 ? `, ${redundant} already covered` : '') +
        (tooShort > 0 ? `, ${tooShort} under --min-length` : ''),
    )
  }
  // A run that threw away most of what it built looks identical, from the
  // output file, to one that found little to compose. The threshold is the one
  // knob that decides which, so it says which.
  if (discarded > written / 2 && discarded > 10) {
    report(
      `\nNote: --min-length ${minAligned} discarded ${discarded} composed alignment(s), more than it kept. ` +
        `That is what to expect when the input's own alignments are shorter than the threshold; ` +
        `lower it if the composed bands come out sparse.`,
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
