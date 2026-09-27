// Does an unclipped read ever carry SA, and what does skipping its lookup save?
//
//   node --expose-gc plugins/alignments/benches/saClipGate.probe.ts --bam=<path>
//
// Flags: --rounds=<n> (default 20), --bam, --refName, --start, --end
import { join } from 'node:path'

import { BamFile } from '@gmod/bam'

const arg = (name: string, dflt: string) =>
  process.argv
    .find(a => a.startsWith(`--${name}=`))
    ?.slice(`--${name}=`.length) ?? dflt

const ROUNDS = Number(arg('rounds', '20'))
const BAM = arg(
  'bam',
  join(process.env.HOME!, 'src/jb2bench/data/1000x.shortread.bam'),
)
const REFNAME = arg('refName', 'chr22_mask')
const START = Number(arg('start', '124000'))
const END = Number(arg('end', '143000'))

const CIGAR_S = 4
const CIGAR_H = 5

interface Rec {
  getTag: (t: string) => unknown
  NUMERIC_CIGAR: Uint32Array
}

function clipped(ops: Uint32Array) {
  const n = ops.length
  if (n === 0) {
    return false
  }
  const first = ops[0]! & 0xf
  const last = ops[n - 1]! & 0xf
  return (
    first === CIGAR_S ||
    first === CIGAR_H ||
    last === CIGAR_S ||
    last === CIGAR_H
  )
}

function allSA(records: Rec[]) {
  let n = 0
  for (const r of records) {
    if (r.getTag('SA') !== undefined) {
      n++
    }
  }
  return n
}

function gatedSA(records: Rec[]) {
  let n = 0
  for (const r of records) {
    if (clipped(r.NUMERIC_CIGAR) && r.getTag('SA') !== undefined) {
      n++
    }
  }
  return n
}

function allSAControl(records: Rec[]) {
  let n = 0
  for (const r of records) {
    if (r.getTag('SA') !== undefined) {
      n++
    }
  }
  return n
}

const bam0 = new BamFile({ bamPath: BAM, baiPath: `${BAM}.bai` })
await bam0.getHeader()
const probe = (await bam0.getRecordsForRange(
  REFNAME,
  START,
  END,
)) as unknown as Rec[]
let clippedCount = 0
let withSA = 0
let unclippedWithSA = 0
for (const r of probe) {
  const c = clipped(r.NUMERIC_CIGAR)
  const sa = r.getTag('SA') !== undefined
  clippedCount += c ? 1 : 0
  withSA += sa ? 1 : 0
  unclippedWithSA += sa && !c ? 1 : 0
}
console.log(
  `${probe.length} reads: ${clippedCount} clipped, ${withSA} with SA, ${unclippedWithSA} with SA and no clip`,
)

const all: number[] = []
const gated: number[] = []
const control: number[] = []
for (let round = 0; round < ROUNDS; round++) {
  const bam = new BamFile({ bamPath: BAM, baiPath: `${BAM}.bai` })
  await bam.getHeader()
  const records = (await bam.getRecordsForRange(
    REFNAME,
    START,
    END,
  )) as unknown as Rec[]
  for (const r of records) {
    void r.NUMERIC_CIGAR
  }
  globalThis.gc?.()
  let t = performance.now()
  allSA(records)
  all.push(performance.now() - t)
  t = performance.now()
  gatedSA(records)
  gated.push(performance.now() - t)
  t = performance.now()
  allSAControl(records)
  control.push(performance.now() - t)
}
const min = (a: number[]) => Math.min(...a).toFixed(2)
console.log(`  SA on every read     ${min(all)} ms`)
console.log(`  SA on clipped reads  ${min(gated)} ms`)
console.log(`  SA every read (ctrl) ${min(control)} ms`)
