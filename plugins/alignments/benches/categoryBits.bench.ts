// What does answering `readCategoryBits` cost per read, against the windowed
// CIGAR walk the extract already does for that read?
//
//   node --expose-gc plugins/alignments/benches/categoryBits.bench.ts --only=200x.longread.bam
//   node --expose-gc plugins/alignments/benches/categoryBits.bench.ts --only=200x.longread.cram
//
// Flags: --rounds=<n> (default 30), --data=<dir>, --only=<file>, --refName,
// --start, --end
//
// ONE FIXTURE PER PROCESS (agent-docs/reference/BENCHMARKING.md).
//
// THREE ARMS, one a control:
//   walk     — `forEachMismatch` over the region, the walk every read already
//              pays in `extractFeatureArrays`
//   bits     — `cigarCategoryBits` plus the flags read: what the extract adds
//              per read for the byte
//   control  — a second, separately-declared copy of `bits`
//
// The added cost is `bits / walk`, a share of one piece of extraction rather
// than of the whole, so it is an upper bound on what the byte adds to a fetch.
//
// WHAT IT SAYS (2026-10-12, chr22_mask:124000-143000, load ~3-5, controls
// 0.99-1.04, MIN of 30), with the SV-insertion bit against main without it:
//
//   fixture                 reads     walk     bits   main bits   bits/walk
//   200x.longread.bam         335   24.9 ms   9.6 ms   9.4-9.9     0.39
//   200x.longread.cram        335   45.9 ms   3.2 ms   3.4-3.9     0.07
//   1000x.shortread.bam   153,677   33.9 ms  10.9 ms  10.7         0.32
//   1000x.shortread.cram  153,677   20.2 ms   7.7 ms   7.5         0.38
//
// A long read is the costly case: the walk stops at the region, and the bits
// read every op, 7,300 a read here. `numericCigarCategoryBits` scans a long
// CIGAR branch-free, ORing a bit per op kind seen and per op kind seen at SV
// length; a third compare per op for the insertion cost 10.3-10.9 ms on the
// long BAM. CRAM looks each code's bit up in a table, where three compares
// took 4.6. Neither fixture region holds a read with a category bit, so the
// numbers are the scan alone.
import { join } from 'node:path'

import { BamFile, BamRecord } from '@gmod/bam'
import { CraiIndex, IndexedCramFile } from '@gmod/cram'
import { numericCigarCategoryBits } from '@jbrowse/cigar-utils'

import CramSlightlyLazyFeature from '../src/CramAdapter/CramSlightlyLazyFeature.ts'

import type { MismatchCallback, MismatchWindow } from '@jbrowse/cigar-utils'

// BamSlightlyLazyFeature's getter, on the library's own record: the class
// itself cannot be imported here, since node's strip-only TypeScript refuses
// the parameter properties beside it in that module.
class BamBits extends BamRecord {
  get cigarCategoryBits() {
    return numericCigarCategoryBits(this.NUMERIC_CIGAR)
  }
}

interface BenchRecord {
  readonly flags: number
  readonly cigarCategoryBits: number
  forEachMismatch(callback: MismatchCallback, opts?: MismatchWindow): void
}

const arg = (name: string, dflt: string) =>
  process.argv
    .find(a => a.startsWith(`--${name}=`))
    ?.slice(`--${name}=`.length) ?? dflt

const ROUNDS = Number(arg('rounds', '30'))
const DATA = arg('data', join(process.env.HOME!, 'src/jb2bench/data'))
const ONLY = arg('only', '200x.longread.bam')
const REFNAME = arg('refName', 'chr22_mask')
const START = Number(arg('start', '124000'))
const END = Number(arg('end', '143000'))

async function load(): Promise<BenchRecord[]> {
  const path = join(DATA, ONLY)
  if (ONLY.endsWith('.cram')) {
    const cram = new IndexedCramFile({
      cramPath: path,
      index: new CraiIndex({ path: `${path}.crai` }),
      fetchReferenceSequence: async () => '',
      checkSequenceMD5: false,
      recordClass: CramSlightlyLazyFeature,
    })
    const hdr = (await (
      cram as unknown as { cram: { getSamHeader(): Promise<unknown[]> } }
    ).cram.getSamHeader()) as {
      tag: string
      data: { tag: string; value: string }[]
    }[]
    const seqs = hdr
      .filter(l => l.tag === 'SQ')
      .map(l => l.data.find(d => d.tag === 'SN')?.value)
    const records = await cram.getRecordsForRange(
      seqs.indexOf(REFNAME),
      START,
      END,
    )
    return records
  }
  const bam = new BamFile({
    bamPath: path,
    baiPath: `${path}.bai`,
    recordClass: BamBits,
  })
  await bam.getHeader()
  const records = await bam.getRecordsForRange(REFNAME, START, END)
  return records
}

function armWalk(records: BenchRecord[]) {
  let sink = 0
  const window = { start: START, end: END }
  for (const r of records) {
    r.forEachMismatch((type, start) => {
      sink += type + start
    }, window)
  }
  return sink
}

function armBits(records: BenchRecord[]) {
  let sink = 0
  for (const r of records) {
    sink += r.flags | r.cigarCategoryBits
  }
  return sink
}

function armControl(records: BenchRecord[]) {
  let sink = 0
  for (const r of records) {
    sink += r.flags | r.cigarCategoryBits
  }
  return sink
}

function time(fn: () => number) {
  globalThis.gc?.()
  const t0 = performance.now()
  const sink = fn()
  return { ms: performance.now() - t0, sink }
}

const records = await load()
const withBits = records.filter(r => r.cigarCategoryBits !== 0).length
console.log(
  `${ONLY} ${REFNAME}:${START}-${END}: ${records.length} reads, ${withBits} with a category bit`,
)
if (records.length === 0) {
  throw new Error('the region holds no reads')
}

const best = { walk: Infinity, bits: Infinity, control: Infinity }
for (let i = 0; i < ROUNDS; i++) {
  best.walk = Math.min(best.walk, time(() => armWalk(records)).ms)
  best.bits = Math.min(best.bits, time(() => armBits(records)).ms)
  best.control = Math.min(best.control, time(() => armControl(records)).ms)
}
console.log(
  `walk ${best.walk.toFixed(2)} ms   bits ${best.bits.toFixed(2)} ms   control ${best.control.toFixed(2)} ms`,
)
console.log(
  `bits/walk ${(best.bits / best.walk).toFixed(3)}   control/bits ${(best.control / best.bits).toFixed(2)}`,
)
