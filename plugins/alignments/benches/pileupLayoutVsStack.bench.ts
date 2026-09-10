// What would alignments' pileup row layout cost as the shared `stack`
// transform step?
//
//   node plugins/alignments/benches/pileupLayoutVsStack.bench.ts
//   node plugins/alignments/benches/pileupLayoutVsStack.bench.ts \
//     --rounds=11 --reads=200000 --span=600000 --readlen=150
//
// THE QUESTION. `stack` (packages/core/src/util/featureTransforms.ts) is
// greedy first fit in start order with `padding` bp of clearance, and a plain
// uncapped single-region pileup is that exact rule: `computeLayout` takes the
// canonical order the worker already emits and calls `placeRectCapped`, whose
// clearance is 2. So the rule converges, and what is left to price is not the
// packing but the representation. `computeLayout` reads a `Uint32Array` of
// read positions and writes a `Uint16Array` of rows; `runTransforms` reads a
// `Feature[]` and answers a `Feature[]` each of whose members must then be
// asked for its row.
//
// FIVE ARMS, one a control. The harness rules — interleave, rotate,
// min-of-rounds, a separately-declared control, an identity check before any
// timing is believed — are agent-docs/reference/BENCHMARKING.md.
//   layout      today: `computeLayout` over the worker's typed arrays
//   control     the same call through a second driver literal, so
//               `control / layout` is what this harness could resolve at all
//   stack       the port: a `SimpleFeature` per read, `runTransforms` with one
//               `stack` step, then the rows read back into the `Uint16Array`
//               every pass downstream of the layout indexes by read
//   step        `stack` with the feature list already built, so the gap
//               between the two rows is what materialising costs
//   features    materialising alone, the other half of that gap
import { performance } from 'node:perf_hooks'

import { runTransforms } from '@jbrowse/core/util/featureTransforms'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import { computeLayout } from '../src/RenderAlignmentDataRPC/sortLayout.ts'

import type { WorkerPileupData } from '../src/RenderAlignmentDataRPC/types.ts'
import type { Feature } from '@jbrowse/core/util'
import type { TransformStep } from '@jbrowse/core/util/markEncoding'

const arg = (name: string, fallback: number) =>
  Number(
    process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ??
      fallback,
  )
const rounds = arg('rounds', 7)
const numReads = arg('reads', 200_000)
const span = arg('span', 600_000)
const readLen = arg('readlen', 150)

// Start-sorted, which is what the worker emits and what both arms rely on:
// `computeLayout`'s canonical order is then the identity permutation and
// `stack`'s sort is a stable no-op.
//
// `readKeys.length` and `readPositions` are the whole of what the plain path
// reads — no sort, no soft clips, no cap — and this fixture is those two.
// `baseWorkerPileupData` cannot be reached from a bench: it imports the
// `@jbrowse/alignments-core` barrel, which pulls a `.tsx` node's type
// stripping refuses.
const readPositions = new Uint32Array(numReads * 2)
for (let i = 0; i < numReads; i++) {
  const start = Math.floor((i / numReads) * span)
  readPositions[i * 2] = start
  readPositions[i * 2 + 1] = start + readLen
}
const data = {
  readKeys: Array.from({ length: numReads }, (_, i) => `id${i}`),
  readPositions,
} as unknown as WorkerPileupData

// `padding: 2` is `placeRect`'s hardcoded clearance, so the two arms answer
// the same rows rather than differing wherever two reads abut.
const STEPS: TransformStep[] = [{ type: 'stack', padding: 2 }]

function makeFeatures() {
  const out: Feature[] = []
  for (let i = 0; i < numReads; i++) {
    out.push(
      new SimpleFeature({
        uniqueId: `id${i}`,
        refName: 'chr1',
        start: data.readPositions[i * 2]!,
        end: data.readPositions[i * 2 + 1]!,
      }),
    )
  }
  return out
}

const prebuilt = makeFeatures()

function stackToRows(features: readonly Feature[]) {
  const out = runTransforms(features, STEPS)
  const rows = new Uint16Array(out.length)
  for (let i = 0; i < out.length; i++) {
    rows[i] = out[i]!.get('row')
  }
  return rows
}

// Separate function literals on purpose: a shared driver takes every arm's
// call site polymorphic and prices the harness rather than the code.
const drivers = [
  { name: 'layout', run: () => computeLayout(data).readYs.length },
  { name: 'control', run: () => computeLayout(data).readYs.length },
  { name: 'stack', run: () => stackToRows(makeFeatures()).length },
  { name: 'step', run: () => stackToRows(prebuilt).length },
  { name: 'features', run: () => makeFeatures().length },
]

const { readYs, maxY } = computeLayout(data)
const stacked = stackToRows(prebuilt)
let firstDiff = -1
for (let i = 0; i < numReads; i++) {
  if (readYs[i] !== stacked[i]) {
    firstDiff = i
    break
  }
}
if (firstDiff >= 0) {
  console.error(
    `rows disagree at read ${firstDiff}: layout ${readYs[firstDiff]}, ` +
      `stack ${stacked[firstDiff]}`,
  )
  process.exit(1)
}
console.log(
  `${numReads.toLocaleString()} reads of ${readLen}bp over ${span.toLocaleString()}bp, ` +
    `${maxY} rows deep; layout and stack agree on every row`,
)

for (const { name, run } of drivers) {
  console.log(`${name.padEnd(9)} ${run()}`)
}

const best = drivers.map(() => Infinity)
for (let r = 0; r < rounds; r++) {
  for (let k = 0; k < drivers.length; k++) {
    const i = (k + r) % drivers.length
    const t0 = performance.now()
    drivers[i]!.run()
    best[i] = Math.min(best[i]!, performance.now() - t0)
  }
}

console.log(`\nrounds=${rounds}, min per arm`)
for (const [i, { name }] of drivers.entries()) {
  const ms = best[i]!
  console.log(
    `  ${name.padEnd(9)} ${ms.toFixed(1).padStart(8)}ms  ` +
      `${((ms / numReads) * 1e6).toFixed(0).padStart(5)}ns/read  ` +
      `${(ms / best[0]!).toFixed(2)}x layout`,
  )
}
