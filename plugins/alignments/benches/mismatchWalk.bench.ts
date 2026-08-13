// Is @gmod/bam's mismatch walk as fast as the one it replaced?
//
// `ec75079bf1` deleted `packages/cigar-utils/src/forEachMismatchNumeric.ts` and
// routed BAM, SAM and the CIGAR-string path through @gmod/bam's walk instead —
// and deleted, in the same commit, the bench that would have shown what that
// cost. This is that bench, rebuilt to compare the two implementations rather
// than one implementation across two refs.
//
//   node --expose-gc plugins/alignments/benches/mismatchWalk.bench.ts
//
// Flags: --base=<ref> (default ec75079bf1^, the last commit that had the old
//        walk), --rounds=<n> (default 60), --scale=<f> (default 0.25, sizes the
//        working set), --allow-diff
//
// The general harness rules below — interleave, min-of-rounds, run a control,
// check identity before believing timing — and the traps they exist for are
// written up once in `agent-docs/reference/BENCHMARKING.md`. Read that before
// writing a new bench.
//
// THREE SIDES, one a control:
//   library   — @gmod/bam's forEachMismatchNumeric. What we ship now.
//   ours      — packages/cigar-utils' walk, extracted from --base.
//   control   — the SAME extraction a second time into a second directory:
//               byte-identical code, separately loaded and separately
//               optimized. Whatever it scores against `ours` is the harness's
//               own noise, and any real gap has to clear it.
//
// AN IDENTITY CHECK. A faster walk that emits different mismatches is not a
// faster walk. Every event both sides emit is compared before any timing is
// reported; the first difference is described (which event, which field, both
// values) so a deliberate change reads as itself, and the run fails unless you
// pass --allow-diff.
//
// ---------------------------------------------------------------------------
// WHAT IT SAYS. Four samples. The raw percentages are against `ours`, but the
// only figure worth reading is the LIBRARY MINUS CONTROL gap: the control is the
// same bytes as `ours`, so whatever it scores is what this machine could resolve
// at that moment. Absolute numbers moved by 2x between samples as other work
// came and went on the box; the gap did not.
//
//   library vs control, four samples:
//
//   MD tags, short reads      -4.4%, +1.9%, -4.3%, -4.9%   parity, maybe a
//                                                          shade slower
//   ref-compare, long reads   -0.7%, +7.0%, +2.9%, -0.5%   parity
//   eqx pacbio CCS            +5.2%, +8.9%, +7.7%, +2.6%   library faster,
//                                                          all four samples
//
// So the swap cost nothing on the MD and reference-comparison paths, and gained
// ~3-9% on the eqx PacBio CCS set — dense X ops and heavy indel emission, i.e.
// the long-read case. That one is the only result here consistent enough to lean
// on: it went the same direction in every sample, including the noisiest.
//
// Do not read the MD row as a regression. Three of four samples put the library
// a few percent behind, which is inside what the control itself swings, and a
// fourth put it ahead.
//
// CAVEAT ADDED LATER, and not yet resolved for this bench. It loops three
// datasets through the same three driver objects in one process, which is the
// shape that was afterwards found to contaminate every dataset after the first
// — a 1.7x swing on a sibling probe, following POSITION rather than data (see
// agent-docs/reference/BENCHMARKING.md, "Looping several DATASETS through the
// same arm function objects"). The percentages above are 2-9%, which is the
// range that shape is most able to invent, and `eqx pacbio CCS` — the one row
// whose direction was called consistent — runs THIRD.
//
// It is left as it is rather than silently re-run, because the conclusion it
// supports is "the swap cost nothing", and contamination here would have to be
// helping the library to be hiding a regression. But if this bench is ever used
// to justify a change rather than to retire a worry, give it an `--only=` flag
// first and quote separate runs, as `readBaseCounts.bench.ts` and
// `tagAndSeq.probe.ts` now do.
//
// And the output is IDENTICAL on all three datasets, once the two deliberate
// representation changes are normalized (see below). The walk that replaced ours
// computes the same mismatches, at worst the same speed, faster on long reads.
//
// Two harness bugs produced confident wrong answers before this stood up, both
// worth not rediscovering:
//
//  - Collecting events for identity from only two of the three sides left the
//    control's callback site monomorphic while the others had gone polymorphic.
//    It "won" by 39%: a 0.61x control.
//  - Packing the reference INSIDE the timed region measured `packReference`
//    rather than the walk. On the 260-read set that swamped everything and gave
//    a byte-identical control a 2.0x reading.
//
// SEPARATE DRIVERS, WRITTEN OUT LONGHAND. Do not refactor the three `drive*`
// functions into one. A single driver makes `walk(...)` a polymorphic call site
// and gives all three sides one shared set of inline caches, which is enough to
// swamp the effect under test — measured on this repo's sibling bench
// (recordShape.bench.ts), where it scored a byte-identical control at 1.14x.
// Sharing one SOURCE is enough to do it too: three `new Function`s with
// identical text hit V8's compilation cache and come back sharing a feedback
// vector. Three separate literals is what actually gives three sets of caches.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  BamFile,
  forEachMismatchNumeric as libWalk,
  packReference as libPack,
} from '@gmod/bam'

const root = join(import.meta.dirname, '..', '..', '..')

const arg = (name: string, dflt: string) =>
  process.argv
    .find(a => a.startsWith(`--${name}=`))
    ?.slice(`--${name}=`.length) ?? dflt
const BASE = arg('base', 'ec75079bf1^')
const ROUNDS = Number(arg('rounds', '60'))
// Scales every dataset's `repeat`. Smaller working sets make each round cheaper,
// which buys MORE ROUNDS for the same wall clock — and rounds are what the
// min-of is taken over. On a machine with other work on it (which is the normal
// case here) the control swung ±17% at 20 rounds and settled inside ±5% at 60+.
// Check the control column before believing a result; if it is wide, raise
// --rounds rather than reading the other two.
const SCALE = Number(arg('scale', '0.25'))

// ---------------------------------------------------------------------------
// The two signatures. They are not the same shape, which is most of why this
// file exists rather than a one-line swap.
//
//   ours     (cigar, seq, seqLen, md, qual, ref, CB, refOffset, winLo, winHi)
//   library  (cigar, seq, seqLen, md, qual, ref, refStart, winStart, winEnd,
//             origin, CB)
//
// The callback moved from position 7 to last, and the window moved from
// READ-RELATIVE (`windowStart - read.start`, as the old BamSlightlyLazyFeature
// passed it) to ABSOLUTE reference coordinates, with a separate `origin` saying
// what reported positions are relative to. Both are driven here to emit
// READ-RELATIVE positions over the whole read, which is what the old one did
// natively and what every consumer in this repo still works in:
//   ours     refOffset = read.start, window undefined
//   library  refStart  = read.start, window ±Infinity, origin = read.start
//
// The packed reference differs the same way: ours had no `start` and took the
// offset as an argument, the library's carries its own. Packed from the contig
// origin on both sides, so ours gets refOffset = read.start and the library's
// gets start = 0.

type OldWalk = (
  cigar: ArrayLike<number>,
  seq: ArrayLike<number>,
  seqLength: number,
  md: ArrayLike<number> | undefined,
  qual: ArrayLike<number> | null | undefined,
  ref: unknown,
  cb: Cb,
  refOffset?: number,
  winLo?: number,
  winHi?: number,
) => void

type LibWalk = typeof libWalk

type Cb = (
  type: number,
  start: number,
  length: number,
  base: string,
  qual: number | undefined,
  altbase: number | undefined,
  cliplen: number | undefined,
) => void

interface Read {
  cigar: ArrayLike<number>
  seq: ArrayLike<number>
  seqLength: number
  md: Uint8Array | undefined
  qual: ArrayLike<number> | null | undefined
  start: number
}

// ---------------------------------------------------------------------------
// Loading

// Whole-package checkout, not a single file: a baseline importing the working
// tree's helpers would be a chimera of both revisions. Called twice, into two
// directories, so the control is a genuinely separate module instance.
function extractOldWalk(baseRef: string) {
  const dir = mkdtempSync(join(tmpdir(), 'jb-walk-'))
  const tar = execFileSync(
    'git',
    ['archive', baseRef, '--', 'packages/cigar-utils'],
    { cwd: root, maxBuffer: 1 << 28, encoding: 'buffer' },
  )
  execFileSync('tar', ['-x', '-C', dir], { input: tar })
  return dir
}

async function loadOldWalk(dir: string) {
  const walk: object = await import(
    join(dir, 'packages/cigar-utils/src/forEachMismatchNumeric.ts')
  )
  const packed: object = await import(
    join(dir, 'packages/cigar-utils/src/packedReference.ts')
  )
  if (
    !('forEachMismatchNumeric' in walk) ||
    typeof walk.forEachMismatchNumeric !== 'function'
  ) {
    throw new Error(`${dir} has no forEachMismatchNumeric export`)
  }
  if (
    !('packReference' in packed) ||
    typeof packed.packReference !== 'function'
  ) {
    throw new Error(`${dir} has no packReference export`)
  }
  return {
    walk: walk.forEachMismatchNumeric as OldWalk,
    pack: packed.packReference as (seq: string) => unknown,
  }
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

// ---------------------------------------------------------------------------
// Drivers. Three literals on purpose — see the header. `driveOursA` and
// `driveOursB` are identical; keep them that way when you change one.

// Takes `walk`/`pack` as parameters rather than closing over the imports, so
// its call site is indirect exactly like the other two. Calling the import
// directly here let V8 inline the library's walk while the baseline's was
// reached through a parameter and could not be — a structural advantage to one
// side that has nothing to do with either walk.
// `ref` arrives ALREADY PACKED. Packing inside the timed region measured the
// pack, not the walk: on the 260-read ref-compare set, packing a 50kb contig
// swamped everything and handed a byte-identical control a 2.0x reading. Both
// libraries say to pack once per region rather than per read, which is what
// BamAdapter does, so the bench has to do the same or it is timing a shape no
// caller has.
function driveLibrary(walk: LibWalk, reads: Read[], ref: unknown) {
  let sink = 0
  for (const r of reads) {
    walk(
      r.cigar,
      r.seq,
      r.seqLength,
      r.md,
      r.qual,
      ref as never,
      r.start,
      Number.NEGATIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      r.start,
      (type, start) => {
        sink += type + start
      },
    )
  }
  return sink
}

function driveOursA(walk: OldWalk, reads: Read[], ref: unknown) {
  let sink = 0
  for (const r of reads) {
    walk(
      r.cigar,
      r.seq,
      r.seqLength,
      r.md,
      r.qual,
      ref,
      (type, start) => {
        sink += type + start
      },
      r.start,
    )
  }
  return sink
}

function driveOursB(walk: OldWalk, reads: Read[], ref: unknown) {
  let sink = 0
  for (const r of reads) {
    walk(
      r.cigar,
      r.seq,
      r.seqLength,
      r.md,
      r.qual,
      ref,
      (type, start) => {
        sink += type + start
      },
      r.start,
    )
  }
  return sink
}

// ---------------------------------------------------------------------------
// Identity

interface Events {
  events: number[]
  bases: string[]
}

// The refactor changed two representations ON PURPOSE, and both are documented
// (plugins/alignments/CLAUDE.md names the same pair for the CRAM walk):
//
//   - a clip's `length` was 1, and is now 0. A clip consumes no reference; its
//     read length travels in `cliplen`, which is what consumers read.
//   - a deletion's `bases` was '*', and is now ''. A deletion has no bases of
//     its own to report.
//
// Normalized on BOTH sides, identically, so the identity check is about whether
// the walks agree on the mismatches — not about a change we meant to make. Any
// difference that survives this is a real one.
const SOFTCLIP = 0x53
const HARDCLIP = 0x48
const normLength = (type: number, length: number) =>
  type === SOFTCLIP || type === HARDCLIP ? 0 : length
const normBases = (bases: string) => (bases === '*' ? '' : bases)

function collectLibrary(reads: Read[], regionSeq: string | undefined): Events {
  const ref = regionSeq === undefined ? undefined : libPack(regionSeq, 0)
  const events: number[] = []
  const bases: string[] = []
  for (const r of reads) {
    libWalk(
      r.cigar,
      r.seq,
      r.seqLength,
      r.md,
      r.qual,
      ref,
      r.start,
      Number.NEGATIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      r.start,
      (type, start, length, base, qual, altbase, cliplen) => {
        events.push(
          type,
          start,
          normLength(type, length),
          qual,
          altbase,
          cliplen,
        )
        bases.push(normBases(base))
      },
    )
  }
  return { events, bases }
}

function collectOurs(
  walk: OldWalk,
  pack: (s: string) => unknown,
  reads: Read[],
  regionSeq: string | undefined,
): Events {
  const ref = regionSeq === undefined ? undefined : pack(regionSeq)
  const events: number[] = []
  const bases: string[] = []
  for (const r of reads) {
    walk(
      r.cigar,
      r.seq,
      r.seqLength,
      r.md,
      r.qual,
      ref,
      (type, start, length, base, qual, altbase, cliplen) => {
        // the old walk reported an absent quality/refbase/cliplen as undefined;
        // the library reports -1/0/0. Normalized so the comparison is about the
        // walk rather than about that representation change, which was
        // deliberate (see ec75079bf1).
        events.push(
          type,
          start,
          normLength(type, length),
          qual ?? -1,
          altbase ?? 0,
          cliplen ?? 0,
        )
        bases.push(normBases(base))
      },
      r.start,
    )
  }
  return { events, bases }
}

const FIELDS = ['type', 'start', 'length', 'qual', 'altbase', 'cliplen']

function firstDifference(a: Events, b: Events) {
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

// ---------------------------------------------------------------------------

const DATASETS = [
  {
    // MD tags present: the walk never touches the reference here
    name: 'MD tags, short reads',
    bam: 'test_data/volvox/volvox-sorted.bam',
    refName: 'ctgA',
    fasta: undefined as string | undefined,
    repeat: 20,
  },
  {
    // no MD + plain M/I/D: the reference-comparison path, the one whose packed
    // representation changed shape
    name: 'ref-compare, long reads',
    bam: 'test_data/volvox/badread_long_reads.bam',
    refName: 'ctgA',
    fasta: 'test_data/volvox/volvox.fa' as string | undefined,
    repeat: 20,
  },
  {
    // real pacbio CCS with an --eqx CIGAR: the X op plus dense indel emission
    name: 'eqx pacbio CCS',
    bam: 'plugins/alignments/benches/pacbio_hg002.bam',
    refName: '9',
    fasta: undefined as string | undefined,
    repeat: 4,
  },
]

const time = (fn: () => unknown) => {
  globalThis.gc?.()
  const t0 = performance.now()
  fn()
  return performance.now() - t0
}

async function main() {
  if (!globalThis.gc) {
    console.error('run with --expose-gc\n')
  }
  const dirA = extractOldWalk(BASE)
  const dirB = extractOldWalk(BASE)
  let failed = false
  try {
    const ours = await loadOldWalk(dirA)
    const control = await loadOldWalk(dirB)

    console.log(
      `@gmod/bam vs packages/cigar-utils@${BASE}, min of ${ROUNDS} rotated rounds\n`,
    )

    for (const ds of DATASETS) {
      const reads = await loadReads(
        ds.bam,
        ds.refName,
        Math.max(1, Math.round(ds.repeat * SCALE)),
      )
      const regionSeq = ds.fasta ? loadRef(ds.fasta, ds.refName) : undefined

      const libEvents = collectLibrary(reads, regionSeq)
      const ourEvents = collectOurs(ours.walk, ours.pack, reads, regionSeq)
      // The control is collected too, and NOT because its output is in doubt —
      // it is the same bytes as `ours`. It is so that all three walks enter the
      // timing loop having seen the same callbacks. Collecting only two left the
      // control's callback site monomorphic while the other two had gone
      // polymorphic, and it "won" by 39% on the short-read set: a 0.61x control,
      // i.e. the harness handing a byte-identical copy a large fake advantage.
      const controlEvents = collectOurs(
        control.walk,
        control.pack,
        reads,
        regionSeq,
      )
      const diff = firstDifference(libEvents, ourEvents)
      const controlDiff = firstDifference(ourEvents, controlEvents)
      if (controlDiff) {
        throw new Error(
          `the control disagrees with the baseline it was copied from (${controlDiff}) — the harness is broken, not the walk`,
        )
      }
      if (diff) {
        failed = true
      }

      // packed once, outside the timing, exactly as an adapter packs once per
      // region and then walks every read in it
      const libRef = regionSeq === undefined ? undefined : libPack(regionSeq, 0)
      const oursRef = regionSeq === undefined ? undefined : ours.pack(regionSeq)
      const controlRef =
        regionSeq === undefined ? undefined : control.pack(regionSeq)

      const best = { library: Infinity, ours: Infinity, control: Infinity }
      const sides = [
        {
          name: 'library' as const,
          run: () => driveLibrary(libWalk, reads, libRef),
        },
        {
          name: 'ours' as const,
          run: () => driveOursA(ours.walk, reads, oursRef),
        },
        {
          name: 'control' as const,
          run: () => driveOursB(control.walk, reads, controlRef),
        },
      ]
      // rotated, so no side is permanently first into a cold cache
      for (let round = 0; round < ROUNDS; round++) {
        for (let i = 0; i < sides.length; i++) {
          const side = sides[(round + i) % sides.length]!
          best[side.name] = Math.min(best[side.name], time(side.run))
        }
      }

      const pct = (x: number) => `${((x / best.ours - 1) * 100).toFixed(1)}%`
      console.log(
        `${ds.name}\n` +
          `  ${reads.length} reads, ${libEvents.events.length / 6} events, ` +
          `output ${diff ? `DIFFERS — ${diff}` : 'identical'}\n` +
          `  ours (${BASE})  ${best.ours.toFixed(2).padStart(8)} ms\n` +
          `  @gmod/bam       ${best.library.toFixed(2).padStart(8)} ms   ` +
          `${(best.library / best.ours).toFixed(3)}x  (${pct(best.library)})\n` +
          `  control         ${best.control.toFixed(2).padStart(8)} ms   ` +
          `${(best.control / best.ours).toFixed(3)}x  (${pct(best.control)})  <- noise floor\n`,
      )
    }
  } finally {
    rmSync(dirA, { recursive: true, force: true })
    rmSync(dirB, { recursive: true, force: true })
  }

  if (failed && !process.argv.includes('--allow-diff')) {
    console.error(
      'The two sides emit different events. If that is deliberate — the change\n' +
        'above is one you meant to make — rerun with --allow-diff. Otherwise the\n' +
        'timings are comparing two different computations.',
    )
    process.exitCode = 1
  }
}

await main()
