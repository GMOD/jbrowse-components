// Whether the per-base extract should write typed columns or push an object per
// entry and copy them into typed arrays afterwards. modExtract.bench.ts scored
// the same substitution a loss for modification calls, so this arm came before
// the rewrite shipped.
//
//   node --expose-gc plugins/alignments/benches/perBaseColumns.bench.ts --bin=1
//
// Flags: --rounds=<n> (default 20), --bin=<binBp> (default 1), --depth=<n>
// (default 1, repeats the fixture). One bin per process, so no arm inherits
// another bin's warmup.
//
// Harness rules (interleave, min of rounds, a byte-identical control, an
// identity check before any timing is believed): BENCHMARKING.md. The arms are
// written out longhand for the reason modExtract.bench.ts gives; the CIGAR walk
// they share is the one every arm reaches by the same route.
//
//   objects — an entry object per sampled base, then the copy into typed
//             arrays the old buildArrays.ts made
//   columns — PerBaseColumns, what ships
//   control — a second, separately declared copy of `objects`
//
// WHAT IT SAYS, 2026-09-23 at load 45, --rounds=12:
//
//   binBp 1   30.6M entries   columns 4.039x   control 1.039x
//   binBp 16   1.9M entries   columns 1.160x   control 0.872x
//   binBp 512   60k entries   columns 0.949x   control 0.660x
//
// A win where the wall is big, and inside the control's noise where it is
// not. The mod bench's loss came from entries dying in the nursery; these
// accumulate across every read in the group.

import { join } from 'node:path'

import { BamFile } from '@gmod/bam'

const REPO = new URL('../../..', import.meta.url).pathname
const REFNAME = '9'

const { forEachAlignedBaseInRegion, PerBaseColumns } = await import(
  join(REPO, 'plugins/alignments/src/features/alignedBaseWalk.ts')
)

const arg = (n: string, d: number) =>
  Number(
    process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d,
  )
const ROUNDS = arg('rounds', 20)
const BIN = arg('bin', 1)
const DEPTH = arg('depth', 1)

interface Read {
  start: number
  qual: Uint8Array
  ops: ArrayLike<number>
}

const bam = new BamFile({
  bamPath: join(REPO, 'plugins/alignments/benches/pacbio_hg002.bam'),
  baiPath: join(REPO, 'plugins/alignments/benches/pacbio_hg002.bam.bai'),
})
await bam.getHeader()
const records = await bam.getRecordsForRange(REFNAME, 0, 300_000_000)
const reads: Read[] = []
for (let i = 0; i < DEPTH; i++) {
  for (const r of records) {
    if (r.qual) {
      reads.push({ start: r.start, qual: r.qual, ops: r.NUMERIC_CIGAR })
    }
  }
}
const lo = Math.min(...records.map(r => r.start))
const hi = Math.max(...records.map(r => r.end))
const region = { refName: REFNAME, start: lo, end: hi, assemblyName: 'hg002' }

interface Entry {
  readIndex: number
  position: number
  score: number
}

interface Columns {
  positions: ArrayLike<number>
  values: ArrayLike<number>
  readIndices: ArrayLike<number>
}

function runObjects(binBp: number) {
  const out: Entry[] = []
  for (let i = 0; i < reads.length; i++) {
    const r = reads[i]!
    forEachAlignedBaseInRegion(
      r.ops,
      r.start,
      region,
      binBp,
      (position: number, q: number) => {
        out.push({ readIndex: i, position, score: r.qual[q]! })
      },
    )
  }
  const n = out.length
  const positions = new Uint32Array(n)
  const values = new Uint8Array(n)
  const readIndices = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    const e = out[i]!
    positions[i] = e.position
    values[i] = e.score
    readIndices[i] = e.readIndex
  }
  return { positions, values, readIndices }
}

function runColumns(binBp: number) {
  const out = new PerBaseColumns()
  for (let i = 0; i < reads.length; i++) {
    const r = reads[i]!
    forEachAlignedBaseInRegion(
      r.ops,
      r.start,
      region,
      binBp,
      (position: number, q: number) => {
        out.push(i, position, r.qual[q]!)
      },
    )
  }
  return out.finish() as Columns
}

function runControl(binBp: number) {
  const out: Entry[] = []
  for (let i = 0; i < reads.length; i++) {
    const r = reads[i]!
    forEachAlignedBaseInRegion(
      r.ops,
      r.start,
      region,
      binBp,
      (position: number, q: number) => {
        out.push({ readIndex: i, position, score: r.qual[q]! })
      },
    )
  }
  const n = out.length
  const positions = new Uint32Array(n)
  const values = new Uint8Array(n)
  const readIndices = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    const e = out[i]!
    positions[i] = e.position
    values[i] = e.score
    readIndices[i] = e.readIndex
  }
  return { positions, values, readIndices }
}

function sameColumns(a: Columns, b: Columns) {
  const eq = (x: ArrayLike<number>, y: ArrayLike<number>) => {
    if (x.length !== y.length) {
      return false
    }
    for (let i = 0; i < x.length; i++) {
      if (x[i] !== y[i]) {
        return false
      }
    }
    return true
  }
  return (
    eq(a.positions, b.positions) &&
    eq(a.values, b.values) &&
    eq(a.readIndices, b.readIndices)
  )
}

const reference = runObjects(BIN)
if (
  !sameColumns(reference, runColumns(BIN)) ||
  !sameColumns(reference, runControl(BIN))
) {
  throw new Error('arms disagree on the columns they produce')
}
console.log(
  `pacbio_hg002.bam ${REFNAME}:${lo}-${hi}, ${reads.length} reads, binBp=${BIN}: ${reference.positions.length.toLocaleString()} entries`,
)

const arms = { objects: runObjects, columns: runColumns, control: runControl }
const best: Record<string, number> = {
  objects: Infinity,
  columns: Infinity,
  control: Infinity,
}
const names = Object.keys(arms) as (keyof typeof arms)[]
for (let round = 0; round < ROUNDS; round++) {
  const order = round % 2 ? [...names].reverse() : names
  for (const name of order) {
    globalThis.gc?.()
    const t = performance.now()
    arms[name](BIN)
    best[name] = Math.min(best[name]!, performance.now() - t)
  }
}
for (const name of names) {
  console.log(
    `  ${name.padEnd(8)} ${best[name]!.toFixed(1).padStart(8)}ms  ${(best.objects! / best[name]!).toFixed(3)}x`,
  )
}
