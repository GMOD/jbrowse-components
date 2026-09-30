// What do coverage per group and a stack cost in the worker, against the
// plain coverage a reader already pays for, over a region of reads?
//
//   node --max-old-space-size=8000 packages/core/benches/stackSteps.bench.ts
//   node ... stackSteps.bench.ts --reads=1000000 --rounds=5 --groups=3
//
// Arms interleaved round-robin with the order rotated, MIN across rounds
// (agent-docs/reference/BENCHMARKING.md), each through its own driver:
//
//   coverage           the depth of every read, one run per change
//   coverage-control   the same call again, the harness's floor
//   coverage-grouped   a depth per group, every group cut at every change
//   grouped-stacked    the grouped depths stood on each other
//   bins-grouped       a count per bin per group
//   bins-stacked       those counts stood on each other
import { performance } from 'node:perf_hooks'

import { runTransforms } from '../src/util/featureTransforms.ts'
import SimpleFeature from '../src/util/simpleFeature.ts'

import type { TransformStep } from '../src/util/markEncodingTypes.ts'

const flag = (name: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1]
const num = (name: string, fallback: number) => Number(flag(name) ?? fallback)
const rounds = num('rounds', 5)
const n = num('reads', 1_000_000)
const groups = num('groups', 3)

// reads 150 bp long, 30x over a region, scattered by a hash so their edges
// seldom coincide, dealt round-robin over the groups
const span = Math.floor((n * 150) / 30)
const reads = Array.from({ length: n }, (_, i) => {
  const start = Math.floor((((i * 2654435761) >>> 0) / 2 ** 32) * span)
  return new SimpleFeature({
    uniqueId: `r${i}`,
    refName: 'chr1',
    start,
    end: start + 150,
    hp: String(1 + (i % groups)),
  })
})

const COVERAGE: TransformStep[] = [{ type: 'coverage' }]
const GROUPED: TransformStep[] = [{ type: 'coverage', groupby: ['hp'] }]
const STACKED: TransformStep[] = [
  { type: 'coverage', groupby: ['hp'] },
  { type: 'stack', field: 'coverage', by: 'hp' },
]
const BINS: TransformStep[] = [
  { type: 'bin', step: 1000 },
  {
    type: 'aggregate',
    groupby: ['start', 'end', 'hp'],
    ops: [{ op: 'count', as: 'count' }],
  },
]
const BINS_STACKED: TransformStep[] = [
  ...BINS,
  { type: 'stack', field: 'count', by: 'hp' },
]

const arms: [string, () => number][] = [
  ['coverage', () => runTransforms(reads, COVERAGE).length],
  ['coverage-control', () => runTransforms(reads, COVERAGE).length],
  ['coverage-grouped', () => runTransforms(reads, GROUPED).length],
  ['grouped-stacked', () => runTransforms(reads, STACKED).length],
  ['bins-grouped', () => runTransforms(reads, BINS).length],
  ['bins-stacked', () => runTransforms(reads, BINS_STACKED).length],
]
const best = new Map<string, number>()
const rows = new Map<string, number>()
for (let r = 0; r < rounds; r++) {
  for (let k = 0; k < arms.length; k++) {
    const [name, run] = arms[(k + r) % arms.length]!
    const t0 = performance.now()
    const out = run()
    best.set(name, Math.min(best.get(name) ?? Infinity, performance.now() - t0))
    rows.set(name, out)
  }
}
console.log(
  `${n.toLocaleString()} reads over ${span.toLocaleString()} bp, ${groups} groups, min of ${rounds} rounds`,
)
for (const [name] of arms) {
  const ms = best.get(name)!
  console.log(
    `${name.padEnd(18)} ${ms.toFixed(0).padStart(7)} ms  ${(ms / best.get('coverage')!).toFixed(2)}x  ${rows.get(name)!.toLocaleString()} rows`,
  )
}
