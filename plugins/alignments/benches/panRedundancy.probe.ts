// Does a pan re-inflate and re-parse bytes it already has?
//
//   node --experimental-transform-types plugins/alignments/benches/panRedundancy.probe.ts --only=1000x.shortread.bam
//
// @gmod/bam keys its parsed-chunk cache on the MERGED chunk's virtual-offset
// span, and the merge is query-dependent, so two overlapping queries over the
// same bytes can parse them twice (@gmod/bam ADR 0019, seam 2 in
// agent-docs/reference/BAM_STACK_INTEGRATION.md).
//
// This measures it from the consumer side, with no library patch: step a window
// across the contig the way a user pans, and instrument the FileHandle so every
// byte @gmod/bam reads is counted. Redundancy shows up as bytes read more than
// once across the pan, and as wall-clock that does not fall on windows whose
// data is already in memory.
//
// Not a comparative bench — one arm, no control. It reports counters, not a
// ratio.

import { join } from 'node:path'

import { BamFile } from '@gmod/bam'
import { LocalFile } from 'generic-filehandle2'

const DATA = join(process.env.HOME!, 'src/jb2bench/data')

function arg(name: string, dflt: string) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : dflt
}

const only = arg('only', '1000x.shortread.bam')
const REFNAME = arg('refName', 'chr22_mask')
const START = Number(arg('start', '124000'))
const WIDTH = Number(arg('width', '19000'))
const STEP = Number(arg('step', '9500'))
const STEPS = Number(arg('steps', '10'))

// Counts every read the library issues, so "bytes inflated" is measured rather
// than inferred. Ranges are recorded to a byte-interval set so a second read of
// the same range is visibly redundant.
class CountingFile extends LocalFile {
  reads = 0
  bytes = 0
  ranges: [number, number][] = []
  override async read(length: number, position: number) {
    this.reads++
    this.bytes += length
    this.ranges.push([position, position + length])
    return super.read(length, position)
  }
}

function uniqueBytes(ranges: [number, number][]) {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0])
  let total = 0
  let curStart = -1
  let curEnd = -1
  for (const [s, e] of sorted) {
    if (curEnd < s) {
      if (curEnd > curStart) {
        total += curEnd - curStart
      }
      curStart = s
      curEnd = e
    } else if (e > curEnd) {
      curEnd = e
    }
  }
  if (curEnd > curStart) {
    total += curEnd - curStart
  }
  return total
}

const path = join(DATA, only)
const fh = new CountingFile(path)
const bam = new BamFile({
  bamFilehandle: fh,
  baiPath: `${path}.bai`,
})
await bam.getHeader()

const afterHeader = { reads: fh.reads, bytes: fh.bytes }
console.log(
  `fixture=${only}  window=${WIDTH}bp  step=${STEP}bp  steps=${STEPS}\n` +
    `header+index: ${afterHeader.reads} reads, ${(afterHeader.bytes / 1e6).toFixed(2)} MB`,
)
fh.ranges = []
const base = { reads: fh.reads, bytes: fh.bytes }

let totalRecords = 0
let totalMs = 0
console.log('\n  step         region       records    reads    MB     ms')
for (let i = 0; i < STEPS; i++) {
  const s = START + i * STEP
  const e = s + WIDTH
  const r0 = fh.reads
  const b0 = fh.bytes
  const t = performance.now()
  const recs = await bam.getRecordsForRange(REFNAME, s, e)
  const ms = performance.now() - t
  totalRecords += recs.length
  totalMs += ms
  console.log(
    `  ${String(i).padStart(4)}  ${String(s).padStart(7)}-${String(e).padEnd(7)} ${String(recs.length).padStart(8)} ${String(fh.reads - r0).padStart(8)} ${((fh.bytes - b0) / 1e6).toFixed(2).padStart(6)} ${ms.toFixed(0).padStart(6)}`,
  )
}

const readBytes = fh.bytes - base.bytes
const uniq = uniqueBytes(fh.ranges)
console.log(
  `\nTOTALS over the pan\n` +
    `  records          ${totalRecords}\n` +
    `  wall             ${totalMs.toFixed(0)}ms\n` +
    `  file reads       ${fh.reads - base.reads}\n` +
    `  bytes read       ${(readBytes / 1e6).toFixed(2)} MB\n` +
    `  distinct bytes   ${(uniq / 1e6).toFixed(2)} MB\n` +
    `  REDUNDANT        ${(((readBytes - uniq) / readBytes) * 100).toFixed(1)}%  (${((readBytes - uniq) / 1e6).toFixed(2)} MB re-read and re-inflated)`,
)
