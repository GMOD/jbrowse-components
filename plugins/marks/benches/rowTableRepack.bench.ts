// What does a row reorder or a focus cost the mark display under `rows` per
// loaded region, on the main thread, and how many bytes does each gesture
// upload?
//
//   node plugins/marks/benches/rowTableRepack.bench.ts
//   node plugins/marks/benches/rowTableRepack.bench.ts --rows=1000 --features=50000 --rounds=15
//
// The harness rules — interleave, min-of-rounds, a separately-declared
// control — are in agent-docs/reference/BENCHMARKING.md. One process per
// fixture: quote the 100-row and 1000-row numbers from separate runs.
//
// One synthetic region, one `bar` layer: `features` bars dealt across `rows`
// values, each with its hit index. Each arm is the whole main-thread cost of
// one gesture for that region as the display runs it today — `facetRegion`
// moving every layer's rows onto the new layout (and, under a focus, filtering
// every lane and rebuilding the hit index) and the pack the upload then runs:
//
//   reorder          the rows permuted
//   reorder-control  the same call through a second driver, the harness's floor
//   focus            half the rows kept, so half the bars drop out
//
// Beside each time, the instance bytes the gesture uploads for the region.
import { performance } from 'node:perf_hooks'

import { categoricalField } from '@jbrowse/core/util/categoricalField'
import { hitIndexOf } from '@jbrowse/core/util/markEncoding'
import { barMark } from '@jbrowse/render-core/marks'

import { facetRegion, rowsLayout } from '../src/LinearMarkDisplay/facet.ts'

import type { MarkRegionData } from '../src/LinearMarkDisplay/markList.ts'
import type { BarChannels } from '@jbrowse/render-core/marks'

const arg = (name: string, fallback: number) =>
  Number(
    process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ??
      fallback,
  )
const rounds = arg('rounds', 15)
const rows = arg('rows', 100)
const features = arg('features', 50_000)

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const names = Array.from({ length: rows }, (_, r) => `sample${r}`)
const field = categoricalField('sample')

function region(): MarkRegionData {
  const rand = rng(rows * 7919 + features)
  const perRow = Math.floor(features / rows)
  const n = perRow * rows
  const x = new Uint32Array(n)
  const x2 = new Uint32Array(n)
  const y = new Float32Array(n)
  const row = new Uint32Array(n)
  const color = new Uint32Array(n)
  const featureIndex = new Uint32Array(n)
  let i = 0
  for (let r = 0; r < rows; r++) {
    let pos = 0
    for (let k = 0; k < perRow; k++) {
      const len = 100 + Math.floor(rand() * 2000)
      x[i] = pos
      x2[i] = pos + len
      y[i] = rand() * 100
      row[i] = r
      color[i] = 0xff4c72b0
      featureIndex[i] = i
      pos += len
      i++
    }
  }
  return {
    facet: names.map((key, r) => ({ key, firstRow: r, rowCount: 1 })),
    layers: [
      {
        count: n,
        skipped: 0,
        x,
        x2,
        y,
        row,
        color,
        featureIndex,
        yMin: 0,
        yMax: 100,
        flatbush: hitIndexOf(x, x2, y),
      },
    ],
  }
}

const data = region()

const rand = rng(1)
const shuffled = names.toSorted(() => rand() - 0.5)
const kept = names.filter((_, r) => r % 2 === 0)

const layouts = {
  listed: rowsLayout(
    names.map(name => ({ name })),
    field,
  ),
  shuffled: rowsLayout(
    shuffled.map(name => ({ name })),
    field,
  ),
  kept: rowsLayout(
    kept.map(name => ({ name })),
    field,
  ),
}

let flip = 0
function reorderLayout() {
  flip ^= 1
  return flip ? layouts.shuffled : layouts.listed
}
function focusLayout() {
  flip ^= 1
  return flip ? layouts.kept : layouts.listed
}

function packBars(region: MarkRegionData) {
  return barMark.pass.pack(region.layers[0] as BarChannels).byteLength
}

// One driver per arm, written out longhand: a shared driver makes the call
// site polymorphic and hands every arm one set of inline caches.
let bytes = 0
const reorder = () => {
  bytes = packBars(facetRegion(data, reorderLayout()))
}
const reorderControl = () => {
  bytes = packBars(facetRegion(data, reorderLayout()))
}
const focus = () => {
  bytes = packBars(facetRegion(data, focusLayout()))
}

const ARMS = [
  { name: 'reorder', run: reorder },
  { name: 'reorder-control', run: reorderControl },
  { name: 'focus', run: focus },
]

const best = ARMS.map(() => Infinity)
const uploaded = ARMS.map(() => 0)
for (let r = 0; r < rounds; r++) {
  for (const [i, { run }] of ARMS.entries()) {
    const t0 = performance.now()
    run()
    best[i] = Math.min(best[i]!, performance.now() - t0)
    uploaded[i] = bytes
  }
}

console.log(
  `rounds=${rounds}, ${rows} rows, ${data.layers[0]!.count.toLocaleString()} bars in one region, min per arm`,
)
for (const [i, { name }] of ARMS.entries()) {
  const ms = best[i]!
  console.log(
    `  ${name.padEnd(16)} ${ms.toFixed(2).padStart(8)}ms  ` +
      `${(uploaded[i]! / 1024).toFixed(0).padStart(6)} KiB uploaded  ` +
      `${(ms / best[0]!).toFixed(2)}x reorder`,
  )
}
