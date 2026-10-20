// What ADR-238's predicate list costs against the alignments display's
// hand-written read filter: the default flag exclusion (unmapped, QC-failed,
// duplicate) plus a MAPQ floor, over BAM-shaped records. Interleaved in one
// process, min over rounds.
//
//   node packages/core/benches/fieldPredicate.bench.ts
//   node packages/core/benches/fieldPredicate.bench.ts --rounds=9 --reads=2000000
import { performance } from 'node:perf_hooks'

import { compilePredicates } from '../src/util/fieldPredicate.ts'

import type {
  FieldPredicate,
  PredicateLane,
} from '../src/util/fieldPredicate.ts'

const arg = (name: string, fallback: number) =>
  Number(
    process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ??
      fallback,
  )
const rounds = arg('rounds', 7)
const n = arg('reads', 1_000_000)

class Read {
  flags: number
  private readonly mapq: number
  constructor(flags: number, mapq: number) {
    this.flags = flags
    this.mapq = mapq
  }
  get mq() {
    return this.mapq === 255 ? undefined : this.mapq
  }
}

const UNMAPPED = 4
const QC_FAIL = 512
const DUPLICATE = 1024
const FLAG_EXCLUDE = UNMAPPED | QC_FAIL | DUPLICATE
const MIN_MAPQ = 20

let seed = 7
const rand = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648
  return seed / 2147483648
}
const reads = Array.from(
  { length: n },
  () =>
    new Read(
      (rand() < 0.02 ? UNMAPPED : 0) |
        (rand() < 0.01 ? QC_FAIL : 0) |
        (rand() < 0.08 ? DUPLICATE : 0) |
        (rand() < 0.5 ? 16 : 0),
      Math.floor(rand() * 61),
    ),
)

function handWritten() {
  let kept = 0
  for (let i = 0; i < n; i++) {
    const read = reads[i]!
    const mq = read.mq
    if (
      (read.flags & FLAG_EXCLUDE) === 0 &&
      (mq === undefined || mq >= MIN_MAPQ)
    ) {
      kept++
    }
  }
  return kept
}

// Lanes over the record the caller holds, as the alignments filter would read
// them: one record per call, the flags fused into one mask compare
const flagsOf = (read: Read) => read.flags
const bit = (mask: number): PredicateLane<Read> => ({
  kind: 'bits',
  word: flagsOf,
  mask,
})
const lanes: Record<string, PredicateLane<Read>> = {
  unmapped: bit(UNMAPPED),
  qcFail: bit(QC_FAIL),
  duplicate: bit(DUPLICATE),
  mapq: { kind: 'get', get: read => read.mq ?? 255 },
}
const predicates: FieldPredicate[] = [
  { field: 'unmapped', equal: false },
  { field: 'qcFail', equal: false },
  { field: 'duplicate', equal: false },
  { field: 'mapq', gte: MIN_MAPQ },
]
const test = compilePredicates<Read>(predicates, f => lanes[f])!

function compiled() {
  let kept = 0
  for (let i = 0; i < n; i++) {
    if (test(reads[i]!)) {
      kept++
    }
  }
  return kept
}

const runs = { handWritten, compiled }
const best: Record<string, number> = {}
const kept: Record<string, number> = {}
for (let r = 0; r < rounds; r++) {
  for (const [name, run] of Object.entries(runs)) {
    const t0 = performance.now()
    kept[name] = run()
    const ms = performance.now() - t0
    best[name] = Math.min(best[name] ?? Infinity, ms)
  }
}
if (kept.handWritten !== kept.compiled) {
  throw new Error(`kept differ: ${JSON.stringify(kept)}`)
}
for (const [name, ms] of Object.entries(best)) {
  console.log(
    `${name.padEnd(12)} ${ms.toFixed(1).padStart(7)} ms  ${(ms / best.handWritten!).toFixed(2)}x  kept ${kept[name]}`,
  )
}
