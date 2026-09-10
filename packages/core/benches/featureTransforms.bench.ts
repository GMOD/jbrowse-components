// What does each transform step cost per input feature, ahead of the encode —
// and what does a binned layer hand the encoder in place of the raw list?
//
//   node packages/core/benches/featureTransforms.bench.ts
//   node packages/core/benches/featureTransforms.bench.ts --rounds=9 --features=1000000
//
// Seven arms over one synthetic feature list, interleaved round-robin, min
// across rounds (agent-docs/reference/BENCHMARKING.md). Every arm ends in the
// same native encode (`y`, a constant colour, no index) over whatever the
// steps answered, so a row is "the steps plus the encode of their output":
//
//   none         the encode alone, over the raw list
//   filter       one jexl filter keeping every other feature
//   formula      one jexl formula writing a field, then y reads it
//   bin-count    bin at 10 kb, aggregate count per bin
//   bin-mean     bin at 10 kb, aggregate count and mean score per bin
//   coverage     runs of constant depth over the spans
//   bin-then-raw the bin-count layer and the raw layer both, one fetch —
//                what a multiscale config costs the worker per region
import { performance } from 'node:perf_hooks'

import { runTransforms } from '../src/util/featureTransforms.ts'
import createJexlInstance from '../src/util/jexl.ts'
import { encodeFeatures } from '../src/util/markEncoding.ts'
import SimpleFeature from '../src/util/simpleFeature.ts'

import type { TransformStep } from '../src/util/markEncoding.ts'

const arg = (name: string, fallback: number) =>
  Number(
    process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ??
      fallback,
  )
const rounds = arg('rounds', 7)
const n = arg('features', 1_000_000)

const jexl = createJexlInstance()

const features = Array.from({ length: n }, (_, i) => {
  const start = i * 3
  return new SimpleFeature({
    uniqueId: `f${i}`,
    refName: 'chr1',
    start,
    end: start + 2 + (i % 5),
    score: (i * 7919) % 1000,
  })
})

const BIN: TransformStep[] = [
  { type: 'bin', step: 10_000 },
  {
    type: 'aggregate',
    groupby: ['start', 'end'],
    ops: [{ op: 'count' }],
  },
]

const ARMS: { name: string; y: string; layers: TransformStep[][] }[] = [
  { name: 'none', y: 'score', layers: [[]] },
  {
    name: 'filter',
    y: 'score',
    layers: [[{ type: 'filter', expr: 'jexl:feature.score % 2 == 0' }]],
  },
  {
    name: 'formula',
    y: 'twice',
    layers: [
      [{ type: 'formula', expr: 'jexl:feature.score * 2', as: 'twice' }],
    ],
  },
  { name: 'bin-count', y: 'count', layers: [BIN] },
  {
    name: 'bin-mean',
    y: 'mean_score',
    layers: [
      [
        BIN[0]!,
        {
          type: 'aggregate',
          groupby: ['start', 'end'],
          ops: [{ op: 'count' }, { op: 'mean', field: 'score' }],
        },
      ],
    ],
  },
  { name: 'coverage', y: 'coverage', layers: [[{ type: 'coverage' }]] },
  { name: 'bin-then-raw', y: 'count', layers: [BIN, []] },
]

const drivers = ARMS.map(({ y, layers }) => {
  const lanes = ['y', 'color'] as const
  return () => {
    let last = 0
    for (const [i, steps] of layers.entries()) {
      const out = runTransforms(features, steps, jexl)
      const yField = i === 0 ? y : 'score'
      last += encodeFeatures(out, { y: yField, color: 'red' }, lanes).count
    }
    return last
  }
})

for (const [i, run] of drivers.entries()) {
  console.log(`${ARMS[i]!.name.padEnd(13)} count=${run()}`)
}

const best = ARMS.map(() => Infinity)
for (let r = 0; r < rounds; r++) {
  for (const [i, run] of drivers.entries()) {
    const t0 = performance.now()
    run()
    best[i] = Math.min(best[i]!, performance.now() - t0)
  }
}

console.log(`\nrounds=${rounds}, ${n.toLocaleString()} features, min per arm`)
for (const [i, { name }] of ARMS.entries()) {
  const ms = best[i]!
  console.log(
    `  ${name.padEnd(13)} ${ms.toFixed(1).padStart(8)}ms  ` +
      `${((ms / n) * 1e6).toFixed(0).padStart(6)}ns/feature  ` +
      `${(ms / best[0]!).toFixed(2)}x none`,
  )
}
