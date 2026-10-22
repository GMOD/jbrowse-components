// ADR-240 step 3a's gate: the alignments read filter as a compiled predicate
// list against today's hand-written test, inside a whole BAM fetch. Each round
// opens the file afresh, so both arms pay the inflate and parse they would on
// a refetch, then runs the default flag exclusion and a MAPQ floor over every
// record. Arms interleave in one process; min over rounds.
//
//   node plugins/alignments/benches/readFilterFetch.bench.ts
//   node plugins/alignments/benches/readFilterFetch.bench.ts --rounds=15 --only=1000x.shortread.bam
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'

import { BamFile } from '@gmod/bam'
import { compilePredicates } from '@jbrowse/core/util/fieldPredicate'

import BamSlightlyLazyFeature from '../src/BamAdapter/BamSlightlyLazyFeature.ts'
import { getMappingQuality } from '../src/shared/util.ts'

import type {
  FieldPredicate,
  PredicateLane,
} from '@jbrowse/core/util/fieldPredicate'

const DATA = join(process.env.HOME!, 'src/jb2bench/data')

function arg(name: string, dflt: string) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : dflt
}

const only = arg('only', '1000x.shortread.bam')
const REFNAME = arg('refName', 'chr22_mask')
const START = Number(arg('start', '124000'))
const END = Number(arg('end', '143000'))
const ROUNDS = Number(arg('rounds', '9'))

const FLAG_EXCLUDE = 4 | 512 | 1024
const MIN_MAPQ = 20

type Rec = BamSlightlyLazyFeature

function handWritten(read: Rec) {
  const mq = getMappingQuality(read)
  return (read.flags & FLAG_EXCLUDE) === 0 && (mq === 255 || mq >= MIN_MAPQ)
}

const flagsOf = (read: Rec) => read.flags
const bit = (mask: number): PredicateLane<Rec> => ({
  kind: 'bits',
  word: flagsOf,
  mask,
})
const lanes: Record<string, PredicateLane<Rec>> = {
  'flags.UNMAP': bit(4),
  'flags.QCFAIL': bit(512),
  'flags.DUP': bit(1024),
  mapq: { kind: 'get', get: getMappingQuality },
}
const predicates: FieldPredicate[] = [
  { field: 'flags.UNMAP', equal: false },
  { field: 'flags.QCFAIL', equal: false },
  { field: 'flags.DUP', equal: false },
  { field: 'mapq', gte: MIN_MAPQ },
]
const compiled = compilePredicates<Rec>(predicates, f => lanes[f])!

const path = join(DATA, only)

async function fetchAndFilter(keeps: (read: Rec) => boolean) {
  const bam = new BamFile({
    bamPath: path,
    baiPath: `${path}.bai`,
    recordClass: BamSlightlyLazyFeature,
  })
  await bam.getHeader()
  const t0 = performance.now()
  const records = await bam.getRecordsForRange(REFNAME, START, END)
  const t1 = performance.now()
  let kept = 0
  for (const read of records) {
    if (keeps(read)) {
      kept++
    }
  }
  const t2 = performance.now()
  return { total: t2 - t0, filter: t2 - t1, kept, records: records.length }
}

const arms = { handWritten, compiled }
const best: Record<string, { total: number; filter: number }> = {}
const kept: Record<string, number> = {}
let records = 0
for (let r = 0; r < ROUNDS; r++) {
  for (const [name, keeps] of Object.entries(arms)) {
    const run = await fetchAndFilter(keeps)
    kept[name] = run.kept
    records = run.records
    const prev = best[name]
    best[name] = {
      total: Math.min(prev?.total ?? Infinity, run.total),
      filter: Math.min(prev?.filter ?? Infinity, run.filter),
    }
  }
}
if (kept.handWritten !== kept.compiled) {
  throw new Error(`kept differ: ${JSON.stringify(kept)}`)
}
console.log(
  `${only} ${REFNAME}:${START}-${END}  ${records} records, ${kept.compiled} kept, min of ${ROUNDS}`,
)
for (const [name, { total, filter }] of Object.entries(best)) {
  console.log(
    `${name.padEnd(12)} fetch+filter ${total.toFixed(1).padStart(8)} ms   filter ${filter.toFixed(2).padStart(7)} ms`,
  )
}
