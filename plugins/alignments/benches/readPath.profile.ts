// Where does the BAM read path spend its time today?
//
//   node --cpu-prof --cpu-prof-dir=out profile-readpath.ts --only=1000x.shortread.bam
//
// Drives the two phases a render actually pays for, through the SHIPPED code:
//   1. @gmod/bam getRecordsForRange  (index -> chunks -> inflate -> parse)
//   2. extractFeatureArrays          (per-read: tags, mismatch walk, arrays)
//
// Deliberately not a comparative bench — no arms, no control. It answers "where
// does the time go", which is a profile question, not a ratio question.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { BamFile } from '@gmod/bam'

const REPO = new URL('../../..', import.meta.url).pathname
const DATA = join(process.env.HOME!, 'src/jb2bench/data')

function arg(name: string, dflt: string) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : dflt
}

const only = arg('only', '1000x.shortread.bam')
const REFNAME = arg('refName', 'chr22_mask')
const START = Number(arg('start', '124000'))
const END = Number(arg('end', '143000'))
const ROUNDS = Number(arg('rounds', '5'))

const { extractFeatureArrays } = await import(
  join(REPO, 'plugins/alignments/src/shared/extractFeatureArrays.ts')
)
const { buildBaseFeatureData } = await import(
  join(REPO, 'plugins/alignments/src/shared/buildBaseFeatureData.ts')
)

const { default: BamSlightlyLazyFeature } = await import(
  join(REPO, 'plugins/alignments/src/BamAdapter/BamSlightlyLazyFeature.ts')
)

const path = join(DATA, only)
const bam = new BamFile({
  bamPath: path,
  baiPath: `${path}.bai`,
  recordClass: BamSlightlyLazyFeature,
})

const tHdr = performance.now()
await bam.getHeader()
const hdrMs = performance.now() - tHdr

const t0 = performance.now()
const records = await bam.getRecordsForRange(REFNAME, START, END)
const fetchMs = performance.now() - t0

// Every record needs an `adapter` for id()/refName; the shipped BamAdapter sets
// it in its filter loop. Mimic just enough of it.
const adapter = { id: 'prof', refIdToName: () => REFNAME }
for (const r of records) {
  ;(r as any).adapter = adapter
}

// Reference bases, so MD-less reads resolve mismatches the way a real fetch does.
let regionSequence: string | undefined
try {
  const fa = readFileSync(join(DATA, 'volvox.fa'), 'utf8')
  const rec = fa.split('>').find(s => s.startsWith(REFNAME))
  regionSequence = rec?.split('\n').slice(1).join('').slice(START, END)
} catch {
  regionSequence = undefined
}

console.log(
  `fixture=${only} ${REFNAME}:${START}-${END}\n` +
    `  records=${records.length}  header=${hdrMs.toFixed(1)}ms  fetch=${fetchMs.toFixed(1)}ms` +
    `  (${((fetchMs / records.length) * 1000).toFixed(2)}us/read)\n` +
    `  reference=${regionSequence ? `${regionSequence.length}bp` : 'none (MD only)'}`,
)

const readIdPrefix = ''
const buildFeatureData = (f: any) => buildBaseFeatureData(f, readIdPrefix)
const extractOpts = {
  colorBy: undefined,
  showSoftClipping: false,
  region: { refName: REFNAME, start: START, end: END, assemblyName: 'volvox' },
  sortTag: undefined,
  regionSequence,
  regionSequenceStart: START,
}

const times: number[] = []
for (let r = 0; r < ROUNDS; r++) {
  const t = performance.now()
  const out = extractFeatureArrays(
    records as any,
    buildFeatureData,
    extractOpts as any,
  )
  const ms = performance.now() - t
  times.push(ms)
  if (r === 0) {
    console.log(
      `  extract emits: features=${out.features.length} mismatches=${out.mismatches.length} ` +
        `gaps=${out.gaps.length} ins=${out.insertions.length} softclips=${out.softclips.length}`,
    )
  }
}
const min = Math.min(...times)
console.log(
  `  extract min=${min.toFixed(1)}ms over ${ROUNDS} rounds  (${((min / records.length) * 1000).toFixed(2)}us/read)`,
)

// The third phase. extractFeatureArrays is not the end of the worker's work:
// executeRenderAlignmentData then builds the per-read arrays, the read-name
// block and the mate-reference table off the SAME records. Timed here so the
// split below is the whole of what a query costs rather than two thirds of it.
const { buildBaseReadArrays } = await import(
  join(REPO, 'plugins/alignments/src/shared/buildBaseReadArrays.ts')
)
const { buildReadNameBlock } = await import(
  join(REPO, 'plugins/alignments/src/shared/readNameBlock.ts')
)
const { buildReadNextRefs } = await import(
  join(REPO, 'plugins/alignments/src/shared/readNextRefs.ts')
)

const buildTimes: number[] = []
for (let r = 0; r < ROUNDS; r++) {
  const t = performance.now()
  buildBaseReadArrays(records as any, readIdPrefix)
  buildReadNameBlock(records as any)
  buildReadNextRefs(records as any)
  buildTimes.push(performance.now() - t)
}
const buildMin = Math.min(...buildTimes)
console.log(
  `  arrays  min=${buildMin.toFixed(1)}ms over ${ROUNDS} rounds  (${((buildMin / records.length) * 1000).toFixed(2)}us/read)`,
)

const total = fetchMs + min + buildMin
console.log(
  `  SPLIT: fetch ${((100 * fetchMs) / total).toFixed(0)}%  extract ${((100 * min) / total).toFixed(0)}%  arrays ${((100 * buildMin) / total).toFixed(0)}%`,
)
