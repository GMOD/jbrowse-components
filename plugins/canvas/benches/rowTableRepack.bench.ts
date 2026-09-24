// What does a row reorder, a focus or a recolour cost the multi-row display
// per loaded region, on the main thread, and how many bytes does each gesture
// upload?
//
//   node plugins/canvas/benches/rowTableRepack.bench.ts
//   node plugins/canvas/benches/rowTableRepack.bench.ts --rows=1000 --features=50000 --rounds=15
//
// The harness rules — interleave, min-of-rounds, a separately-declared
// control — are in agent-docs/reference/BENCHMARKING.md. One process per
// fixture: quote the 100-row and 1000-row numbers from separate runs.
//
// One synthetic region: `features` intervals tiling the region, dealt across
// `rows` partition values. Each arm is the whole main-thread cost of one
// gesture for that region as the display runs it today — the encode
// (`buildMultiRowChannels`, which bakes the drawn row and the row colour into
// every instance) and the pack the upload then runs (`spanMark.pass.pack`):
//
//   reorder          the rows permuted
//   reorder-control  the same call through a second driver, the harness's floor
//   focus            half the rows kept, so half the features drop out
//   recolour         one row's colour override changed
//
// Beside each time, the instance bytes the gesture uploads for the region.
import { performance } from 'node:perf_hooks'

import { spanMark } from '@jbrowse/render-core/marks'

import { buildMultiRowChannels } from '../src/LinearMultiRowFeatureDisplay/rendering/multiRowChannels.ts'

import type { MultiRowRegionData } from '../src/LinearMultiRowFeatureDisplay/rendering/multiRowRenderingBackendTypes.ts'

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

const PALETTE = [0xff4c72b0, 0xffdd8452, 0xff55a868, 0xffc44e52]

function region(): MultiRowRegionData {
  const rand = rng(rows * 7919 + features)
  const perRow = Math.floor(features / rows)
  const n = perRow * rows
  const featureStarts = new Uint32Array(n)
  const featureEnds = new Uint32Array(n)
  const featureColors = new Uint32Array(n)
  const featurePartitionIndex = new Uint32Array(n)
  let i = 0
  for (let r = 0; r < rows; r++) {
    let pos = 0
    for (let k = 0; k < perRow; k++) {
      const len = 100 + Math.floor(rand() * 2000)
      featureStarts[i] = pos
      featureEnds[i] = pos + len
      featureColors[i] = PALETTE[Math.floor(rand() * PALETTE.length)]!
      featurePartitionIndex[i] = r
      pos += len
      i++
    }
  }
  return {
    featureStarts,
    featureEnds,
    featureColors,
    featureDeltas: new Int32Array(0),
    partitionValues: Array.from({ length: rows }, (_, r) => `sample${r}`),
    featurePartitionIndex,
    featureNames: Array.from({ length: n }, () => ''),
    featureIds: Array.from({ length: n }, (_, k) => `f${k}`),
    usedItemRgb: false,
    partitionCandidates: [],
    partitionCandidateValues: [],
    legendCandidates: [],
    resolvedPartitionField: 'sample',
  }
}

const data = region()
const names = data.partitionValues

// Every row carries a palette colour, the display's default configuration.
const colors = names.map((_, r) => PALETTE[r % PALETTE.length]!)

function orderOf(order: readonly string[]) {
  return new Map(order.map((name, i) => [name, i] as const))
}

const rand = rng(1)
const shuffled = names.toSorted(() => rand() - 0.5)
const kept = names.filter((_, r) => r % 2 === 0)

let flip = 0
function reorderInputs() {
  flip ^= 1
  return {
    rowIndexByValue: orderOf(flip ? shuffled : names),
    rowColorsByIndex: colors,
    hiddenColors: new Set<number>(),
  }
}
function focusInputs() {
  flip ^= 1
  return {
    rowIndexByValue: orderOf(flip ? kept : names),
    rowColorsByIndex: colors,
    hiddenColors: new Set<number>(),
  }
}
let tint = 0
function recolourInputs() {
  tint += 1
  const recoloured = colors.slice()
  recoloured[0] = 0xff000000 | (tint & 0xffffff)
  return {
    rowIndexByValue: orderOf(names),
    rowColorsByIndex: recoloured,
    hiddenColors: new Set<number>(),
  }
}

// One driver per arm, written out longhand: a shared driver makes the call
// site polymorphic and hands every arm one set of inline caches.
let bytes = 0
const reorder = () => {
  bytes = spanMark.pass.pack(
    buildMultiRowChannels(data, reorderInputs()),
  ).byteLength
}
const reorderControl = () => {
  bytes = spanMark.pass.pack(
    buildMultiRowChannels(data, reorderInputs()),
  ).byteLength
}
const focus = () => {
  bytes = spanMark.pass.pack(
    buildMultiRowChannels(data, focusInputs()),
  ).byteLength
}
const recolour = () => {
  bytes = spanMark.pass.pack(
    buildMultiRowChannels(data, recolourInputs()),
  ).byteLength
}

const ARMS = [
  { name: 'reorder', run: reorder },
  { name: 'reorder-control', run: reorderControl },
  { name: 'focus', run: focus },
  { name: 'recolour', run: recolour },
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
  `rounds=${rounds}, ${rows} rows, ${data.featureStarts.length.toLocaleString()} features in one region, min per arm`,
)
for (const [i, { name }] of ARMS.entries()) {
  const ms = best[i]!
  console.log(
    `  ${name.padEnd(16)} ${ms.toFixed(2).padStart(8)}ms  ` +
      `${(uploaded[i]! / 1024).toFixed(0).padStart(6)} KiB uploaded  ` +
      `${(ms / best[0]!).toFixed(2)}x reorder`,
  )
}
