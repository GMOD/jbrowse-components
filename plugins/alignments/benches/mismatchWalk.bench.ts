// A/B the mismatch walk in the working tree against the same walk from another
// git ref — the shape of question that actually comes up ("is my branch faster
// than main?").
//
//   node --expose-gc plugins/alignments/benches/mismatchWalk.bench.ts
//   node --expose-gc plugins/alignments/benches/mismatchWalk.bench.ts --base=HEAD~1
//
// Flags: --base=<ref> (default main), --rounds=<n> (default 12), --allow-diff
//
// Two things here are not decoration:
//
// INTERLEAVING. Variants run round-robin within one process and the reported
// number is the MIN across rounds. Timing them in separate processes, or in
// blocks, measures whatever else the machine was doing: on a box under load
// from other work, the same comparison read 10.4x, then 1.74x, then ~1.1x
// across three harness designs before interleaving settled it at parity. Two
// separate agents hit that same trap on the same day. Absolute ms still drift
// by 2x between runs; the within-run ratio does not.
//
// AN IDENTITY CHECK. A faster walk that emits different mismatches is not a
// faster walk. Every event both sides emit is compared before any timing is
// reported; the first difference is described (which event, which field, both
// values) so a deliberate change reads as itself, and the run fails unless you
// pass --allow-diff to say so.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { BamFile } from '@gmod/bam'

const root = join(import.meta.dirname, '..', '..', '..')

// The walk's `ref` argument changed shape (a string, then a packed 4-bit
// reference), so each side prepares its own from the same region sequence.
// Feature-detected rather than version-gated, so this keeps working across the
// next such change instead of needing a new special case.
interface WalkModule {
  forEachMismatchNumeric: (
    cigar: ArrayLike<number>,
    numericSeq: ArrayLike<number>,
    seqLength: number,
    md: ArrayLike<number> | undefined,
    qual: ArrayLike<number> | null | undefined,
    ref: never,
    callback: (
      type: number,
      start: number,
      length: number,
      base: string,
      qual: number | undefined,
      altbase: number | undefined,
      cliplen: number | undefined,
    ) => void,
    refOffset?: number,
    windowLo?: number,
    windowHi?: number,
  ) => void
  packReference?: (seq: string) => unknown
}

function toWalkModule(mod: object, label: string): WalkModule {
  if (
    'forEachMismatchNumeric' in mod &&
    typeof mod.forEachMismatchNumeric === 'function'
  ) {
    return mod as unknown as WalkModule
  }
  throw new Error(`${label} has no forEachMismatchNumeric export`)
}

// Whole-package checkout, not a single file: a baseline that imported the
// working tree's helpers would be a chimera of both revisions.
async function loadBaseline(baseRef: string) {
  const dir = mkdtempSync(join(tmpdir(), 'jb-bench-'))
  const tar = execFileSync(
    'git',
    ['archive', baseRef, '--', 'packages/cigar-utils'],
    { cwd: root, maxBuffer: 1 << 28, encoding: 'buffer' },
  )
  execFileSync('tar', ['-x', '-C', dir], { input: tar })
  const mod: object = await import(
    join(dir, 'packages/cigar-utils/src/forEachMismatchNumeric.ts')
  )
  let packReference: ((seq: string) => unknown) | undefined
  try {
    const packed: object = await import(
      join(dir, 'packages/cigar-utils/src/packedReference.ts')
    )
    if (
      'packReference' in packed &&
      typeof packed.packReference === 'function'
    ) {
      packReference = packed.packReference as (seq: string) => unknown
    }
  } catch {
    // the baseline predates packReference and takes the region string directly
  }
  return {
    module: {
      forEachMismatchNumeric: toWalkModule(mod, baseRef).forEachMismatchNumeric,
      packReference,
    },
    dir,
  }
}

interface Read {
  cigar: ArrayLike<number>
  seq: ArrayLike<number>
  seqLength: number
  md: Uint8Array | undefined
  qual: ArrayLike<number> | null | undefined
  start: number
}

async function loadReads(bamPath: string, refName: string, repeat: number) {
  const bam = new BamFile({
    bamPath: join(root, bamPath),
    baiPath: join(root, `${bamPath}.bai`),
  })
  await bam.getHeader()
  const records = await bam.getRecordsForRange(refName, 0, 300_000_000)
  if (records.length === 0) {
    throw new Error(`no reads on ${refName} in ${bamPath}`)
  }
  const one = records.map(r => ({
    cigar: r.NUMERIC_CIGAR,
    seq: r.NUMERIC_SEQ,
    seqLength: r.seq_length,
    md: r.NUMERIC_MD,
    qual: r.qual,
    start: r.start,
  }))
  const reads: Read[] = []
  for (let i = 0; i < repeat; i++) {
    reads.push(...one)
  }
  return reads
}

// single-contig FASTA; the bench only ever needs one
function loadRef(faPath: string, refName: string) {
  const text = readFileSync(join(root, faPath), 'utf8')
  for (const block of text.split('>')) {
    const nl = block.indexOf('\n')
    if (nl > 0 && block.slice(0, nl).split(/\s/)[0] === refName) {
      return block.slice(nl + 1).replaceAll('\n', '')
    }
  }
  throw new Error(`no ${refName} in ${faPath}`)
}

// Every event the walk emits, flattened. Compared between the two sides before
// any timing is believed.
function walkAll(
  mod: WalkModule,
  reads: Read[],
  regionSeq: string | undefined,
) {
  const events: number[] = []
  const bases: string[] = []
  const ref =
    regionSeq === undefined
      ? undefined
      : mod.packReference
        ? mod.packReference(regionSeq)
        : regionSeq
  for (const r of reads) {
    mod.forEachMismatchNumeric(
      r.cigar,
      r.seq,
      r.seqLength,
      r.md,
      r.qual,
      ref as never,
      (type, start, length, base, qual, altbase, cliplen) => {
        events.push(type, start, length, qual ?? -1, altbase ?? 0, cliplen ?? 0)
        bases.push(base)
      },
      r.start,
    )
  }
  return { events, bases }
}

const FIELDS = ['type', 'start', 'length', 'qual', 'altbase', 'cliplen']

// Describes the first differing event rather than just flagging one, so a
// deliberate representation change (say, altbase switching to uppercase) reads
// as what it is instead of an unexplained failure.
function firstDifference(
  a: { events: number[]; bases: string[] },
  b: { events: number[]; bases: string[] },
) {
  if (a.events.length !== b.events.length) {
    return `event count ${a.events.length / 6} vs ${b.events.length / 6}`
  }
  for (let i = 0; i < a.events.length; i++) {
    if (a.events[i] !== b.events[i]) {
      return `event ${Math.floor(i / 6)} ${FIELDS[i % 6]}: ${a.events[i]} vs ${b.events[i]}`
    }
  }
  for (let i = 0; i < a.bases.length; i++) {
    if (a.bases[i] !== b.bases[i]) {
      return `event ${i} base: "${a.bases[i]}" vs "${b.bases[i]}"`
    }
  }
  return undefined
}

// Timed separately from the identity check: a no-op callback so the number is
// the walk, not a consumer's array-building.
function timeWalk(
  mod: WalkModule,
  reads: Read[],
  regionSeq: string | undefined,
) {
  const ref =
    regionSeq === undefined
      ? undefined
      : mod.packReference
        ? mod.packReference(regionSeq)
        : regionSeq
  let sink = 0
  for (const r of reads) {
    mod.forEachMismatchNumeric(
      r.cigar,
      r.seq,
      r.seqLength,
      r.md,
      r.qual,
      ref as never,
      (type, start) => {
        sink += type + start
      },
      r.start,
    )
  }
  return sink
}

const DATASETS = [
  {
    // no MD + plain M/I/D: the reference-comparison path
    name: 'ref-compare, long reads',
    bam: 'test_data/volvox/badread_long_reads.bam',
    refName: 'ctgA',
    fasta: 'test_data/volvox/volvox.fa',
    repeat: 20,
  },
  {
    // MD tags present: the walk never touches the reference here
    name: 'MD tags, short reads',
    bam: 'test_data/volvox/volvox-sorted.bam',
    refName: 'ctgA',
    fasta: undefined,
    repeat: 2,
  },
  {
    // real pacbio CCS with an --eqx CIGAR: the X op plus dense indel emission
    name: 'eqx pacbio CCS',
    bam: 'plugins/alignments/benches/pacbio_hg002.bam',
    refName: '9',
    fasta: undefined,
    repeat: 4,
  },
]

const baseRef =
  process.argv.find(a => a.startsWith('--base='))?.slice('--base='.length) ??
  'main'
const rounds = Number(
  process.argv
    .find(a => a.startsWith('--rounds='))
    ?.slice('--rounds='.length) ?? 12,
)

// a module namespace object is frozen, so copy out the pieces we drive
async function loadWorkingTree() {
  const walk = toWalkModule(
    await import(
      join(root, 'packages/cigar-utils/src/forEachMismatchNumeric.ts')
    ),
    'working tree',
  )
  const packed: object = await import(
    join(root, 'packages/cigar-utils/src/packedReference.ts')
  ).catch(() => ({}))
  return {
    forEachMismatchNumeric: walk.forEachMismatchNumeric,
    packReference:
      'packReference' in packed && typeof packed.packReference === 'function'
        ? (packed.packReference as (seq: string) => unknown)
        : undefined,
  }
}

const current = await loadWorkingTree()

const { module: baseline, dir } = await loadBaseline(baseRef)

console.log(`working tree vs ${baseRef}, min of ${rounds} interleaved rounds\n`)
let failed = false
try {
  for (const ds of DATASETS) {
    const reads = await loadReads(ds.bam, ds.refName, ds.repeat)
    const regionSeq = ds.fasta ? loadRef(ds.fasta, ds.refName) : undefined

    const a = walkAll(current, reads, regionSeq)
    const b = walkAll(baseline, reads, regionSeq)
    const diff = firstDifference(a, b)
    if (diff) {
      failed = true
    }

    const best = { current: Infinity, baseline: Infinity }
    for (let round = 0; round < rounds; round++) {
      for (const side of ['current', 'baseline'] as const) {
        globalThis.gc?.()
        const mod = side === 'current' ? current : baseline
        const t0 = performance.now()
        timeWalk(mod, reads, regionSeq)
        const dt = performance.now() - t0
        best[side] = Math.min(best[side], dt)
      }
    }
    const ratio = best.current / best.baseline
    console.log(
      `${ds.name}\n` +
        `  ${reads.length} reads, ${a.events.length / 6} events, ` +
        `output ${diff ? `DIFFERS — ${diff}` : 'identical'}\n` +
        `  ${baseRef}      ${best.baseline.toFixed(2).padStart(8)} ms\n` +
        `  working tree ${best.current.toFixed(2).padStart(8)} ms   ${ratio.toFixed(3)}x\n`,
    )
  }
} finally {
  rmSync(dir, { recursive: true, force: true })
}

if (failed && !process.argv.includes('--allow-diff')) {
  console.error(
    'The two sides emit different events. If that is deliberate — the change\n' +
      'above is one you meant to make — rerun with --allow-diff. Otherwise the\n' +
      'timings are comparing two different computations.',
  )
  process.exitCode = 1
}
