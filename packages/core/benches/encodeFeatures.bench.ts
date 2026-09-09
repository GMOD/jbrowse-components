// What does a `jexl:` channel cost against a native field read, per feature,
// through `encodeFeatures` — and what does each lane a caller declines save?
//
//   node packages/core/benches/encodeFeatures.bench.ts
//   node packages/core/benches/encodeFeatures.bench.ts --rounds=9 --features=1000000
//
// Nine arms over one synthetic feature list, interleaved round-robin, min
// across rounds (agent-docs/reference/BENCHMARKING.md). The first seven ask
// for the point shape's lanes and the hit index:
//
//   native      y: 'score', a constant colour — the encoder's own loop and
//               `feature.get` per channel
//   control     the same encoding declared a second time, so the harness's
//               resolution is on the table beside the ratios
//   jexl-y      y: 'jexl:feature.score' — one jexl evaluation per feature
//   jexl-color  y native, colour a jexl ternary — one evaluation per feature
//               plus the CSS colour parse its answer costs
//   scale-color y native, colour a categorical scale over strand — the
//               field read, the value's table lookup and a pass after the walk
//   jexl-glyph  y native, glyph a jexl ternary over strand
//   scale-glyph y native, glyph a categorical scale over strand
//
// The last two decline lanes:
//
//   no-index    native, without the Flatbush — what a display that never
//               hovers through the index saves
//   wiggle      y as a reader and the `y` lane alone, no jexl instance —
//               wiggle's array-less fallback (`featuresToRaw`)
//
// Every arm packs the same x/x2 and skips the same features, so the identity
// check compares `count`, `x` and `y` across arms before any time is believed.
// The feature list is built once and reused: the encoder never allocates per
// feature, so there is no per-arm garbage to skew a later round.
import { performance } from 'node:perf_hooks'

import createJexlInstance from '../src/util/jexl.ts'
import { encodeFeatures } from '../src/util/markEncoding.ts'
import SimpleFeature from '../src/util/simpleFeature.ts'

import type { LaneName, MarkEncodingInput } from '../src/util/markEncoding.ts'

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
    end: start + 2,
    score: (i * 7919) % 1000,
    strand: i % 2 === 0 ? 1 : -1,
  })
})

const POINT_LANES: LaneName[] = ['y', 'color', 'glyph', 'index']

const ARMS: {
  name: string
  encoding: MarkEncodingInput
  lanes?: LaneName[]
}[] = [
  { name: 'native', encoding: { y: 'score', color: 'red' } },
  { name: 'control', encoding: { y: 'score', color: 'red' } },
  { name: 'jexl-y', encoding: { y: 'jexl:feature.score', color: 'red' } },
  {
    name: 'jexl-color',
    encoding: {
      y: 'score',
      color: "jexl:get(feature,'strand')==1?'red':'blue'",
    },
  },
  {
    name: 'scale-color',
    encoding: {
      y: 'score',
      color: { field: 'strand', scale: 'categorical' },
    },
  },
  {
    name: 'jexl-glyph',
    encoding: {
      y: 'score',
      color: 'red',
      glyph: "jexl:get(feature,'strand')==1?'triangle':'disc'",
    },
  },
  {
    name: 'scale-glyph',
    encoding: {
      y: 'score',
      color: 'red',
      glyph: { field: 'strand', scale: 'categorical' },
    },
  },
  {
    name: 'no-index',
    encoding: { y: 'score', color: 'red' },
    lanes: ['y', 'color', 'glyph'],
  },
  {
    name: 'wiggle',
    encoding: { y: f => Number(f.get('score') ?? 0) },
    lanes: ['y'],
  },
]

// One driver per arm, written out rather than shared, so no call site goes
// polymorphic across arms.
const drivers = ARMS.map(({ encoding, lanes = POINT_LANES }) => {
  const enc = encoding
  return () =>
    encodeFeatures(features, enc, lanes, lanes.length === 1 ? {} : { jexl })
})

// identity: every arm admits the same features at the same coordinates
const reference = drivers[0]!()
for (const [i, run] of drivers.entries()) {
  const out = run()
  if (
    out.count !== reference.count ||
    out.x.some((v, k) => v !== reference.x[k]) ||
    out.y.some((v, k) => v !== reference.y[k])
  ) {
    throw new Error(`${ARMS[i]!.name} disagrees with native on x/y/count`)
  }
  console.log(`${ARMS[i]!.name.padEnd(11)} count=${out.count}`)
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
    `  ${name.padEnd(11)} ${ms.toFixed(1).padStart(8)}ms  ` +
      `${((ms / n) * 1e6).toFixed(0).padStart(6)}ns/feature  ` +
      `${(ms / best[0]!).toFixed(2)}x native`,
  )
}
