// The CRAM half of panRedundancy.probe.ts — is the cross-query redundancy that
// probe finds in @gmod/bam a property of the BAM chunk cache, or of the whole
// stack?
//
//   node --experimental-transform-types plugins/alignments/benches/panRedundancyCram.probe.ts --only=200x.shortread.cram
//
// Same instrument, same windows, so the two numbers are comparable. @gmod/cram
// caches DECODED SLICES rather than parsed chunk spans, and a slice is a fixed
// partition of the file rather than a query-dependent merge — so if the seam is
// the query-dependent key, CRAM should not show it.

import { join } from 'node:path'

import { CraiIndex, IndexedCramFile } from '@gmod/cram'
import { LocalFile } from 'generic-filehandle2'

const DATA = join(process.env.HOME!, 'src/jb2bench/data')

function arg(name: string, dflt: string) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : dflt
}

const only = arg('only', '200x.shortread.cram')
const REFNAME = arg('refName', 'chr22_mask')
const START = Number(arg('start', '124000'))
const WIDTH = Number(arg('width', '19000'))
const STEP = Number(arg('step', '9500'))
const STEPS = Number(arg('steps', '10'))

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
      if (curEnd > curStart) total += curEnd - curStart
      curStart = s
      curEnd = e
    } else if (e > curEnd) {
      curEnd = e
    }
  }
  if (curEnd > curStart) total += curEnd - curStart
  return total
}

const path = join(DATA, only)
const fh = new CountingFile(path)
const cram = new IndexedCramFile({
  cramFilehandle: fh,
  index: new CraiIndex({ path: `${path}.crai` }),
  seqFetch: async () => '',
  checkSequenceMD5: false,
})

// resolve the refName to the id the .cram header uses
const hdr = await (cram as any).cram.getSamHeader()
const seqs: string[] = hdr
  .filter((l: any) => l.tag === 'SQ')
  .map((l: any) => l.data.find((d: any) => d.tag === 'SN')?.value)
const refId = seqs.indexOf(REFNAME)
if (refId < 0) {
  console.error(`refName ${REFNAME} not in ${seqs.slice(0, 5).join(',')}...`)
  process.exit(1)
}

fh.ranges = []
const base = { reads: fh.reads, bytes: fh.bytes }

console.log(
  `fixture=${only}  window=${WIDTH}bp  step=${STEP}bp  steps=${STEPS}  refId=${refId}`,
)
console.log('\n  step         region       records    reads    MB     ms')
let totalRecords = 0
let totalMs = 0
for (let i = 0; i < STEPS; i++) {
  const s = START + i * STEP
  const e = s + WIDTH
  const r0 = fh.reads
  const b0 = fh.bytes
  const t = performance.now()
  const recs = await cram.getRecordsForRange(refId, s, e)
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
    `  REDUNDANT        ${readBytes ? (((readBytes - uniq) / readBytes) * 100).toFixed(1) : '0.0'}%  (${((readBytes - uniq) / 1e6).toFixed(2)} MB re-read and re-decoded)`,
)
