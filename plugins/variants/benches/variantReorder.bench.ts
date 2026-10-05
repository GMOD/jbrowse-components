// What does a row reorder cost the multi-sample variant display on the main
// thread, per block, as it runs today — every cell re-placed and the instance
// buffer re-packed — against the same gesture through render-core's
// `buildRowTable`, where the instances stand and a rows-sized table moves?
//
//   node plugins/variants/benches/variantReorder.bench.ts
//   node plugins/variants/benches/variantReorder.bench.ts --rows=5008 --features=1000 --rounds=15
//
// The harness rules — interleave, min-of-rounds, a separately-declared
// control, an identity check before any timing is believed — are in
// agent-docs/reference/BENCHMARKING.md. One process per fixture.
//
// One block of `features` records over `rows` rows, every cell present as the
// columns layout fetches it (`referenceDrawingMode: 'draw'`), in the worker's
// `(feature, row)` order. The place arms are the whole main-thread cost of a
// reorder for that block today: `placeVariantRows` over the payload, the
// painted spread, and the pack the re-upload then runs, `matrixCell`'s 12
// bytes an instance or `cell`'s 20. The table arm is the same gesture through
// `buildRowTable` over the display's row arrangement, which is the whole cost,
// since no cell is touched:
//
//   place-columns    the rows permuted, the block re-placed and re-packed for `matrixCell`
//   place-control    the same call through a second driver, the harness's floor
//   place-genomic    the rows permuted, re-placed and re-packed for `cell`
//   table            the table for the permuted rows
//
// Beside each time, the bytes the gesture uploads. Identity first: the slot
// the table gives every cell's worker row is the row the place arm wrote.
import { performance } from 'node:perf_hooks'

import { buildRowTable } from '@jbrowse/render-core/marks'

import * as cellShader from '../src/LinearMultiSampleVariantDisplay/components/shaders/variant.iface.generated.ts'
import * as matrixShader from '../src/LinearMultiSampleVariantDisplay/matrix/shaders/variantMatrix.iface.generated.ts'
import { placeVariantRows } from '../src/shared/placeVariantRows.ts'

const arg = (name: string, fallback: number) =>
  Number(
    process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ??
      fallback,
  )
const rounds = arg('rounds', 15)
const rows = arg('rows', 2504)
const features = arg('features', 1000)

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const PALETTE = [0xff4c72b0, 0xffdd8452, 0xff55a868, 0xffc44e52]

const numCells = rows * features
const rand = rng(rows * 7919 + features)
const cellRowIndices = new Uint32Array(numCells)
const cellFeatureIndices = new Uint32Array(numCells)
const cellColors = new Uint32Array(numCells)
const featurePositions = new Uint32Array(features * 2)
for (let f = 0; f < features; f++) {
  featurePositions[f * 2] = f * 1000
  featurePositions[f * 2 + 1] = f * 1000 + 1
}
let i = 0
for (let f = 0; f < features; f++) {
  for (let r = 0; r < rows; r++) {
    cellFeatureIndices[i] = f
    cellRowIndices[i] = r
    cellColors[i] = PALETTE[Math.floor(rand() * PALETTE.length)]!
    i++
  }
}
const cellPositions = new Uint32Array(numCells * 2)
const cellShapeTypes = new Uint8Array(numCells)
for (let c = 0; c < numCells; c++) {
  const f = cellFeatureIndices[c]!
  cellPositions[c * 2] = featurePositions[f * 2]!
  cellPositions[c * 2 + 1] = featurePositions[f * 2 + 1]!
}
const payload = { cellRowIndices, cellFeatureIndices, cellColors, numCells }

const identity = new Uint32Array(rows)
const shuffled = new Uint32Array(rows)
for (let r = 0; r < rows; r++) {
  identity[r] = r
  shuffled[r] = r
}
const shuffle = rng(1)
for (let r = rows - 1; r > 0; r--) {
  const j = Math.floor(shuffle() * (r + 1))
  const t = shuffled[r]!
  shuffled[r] = shuffled[j]!
  shuffled[j] = t
}
const rowColor = new Uint32Array(rows)

let flip = 0
function nextRemap() {
  flip ^= 1
  return flip ? shuffled : identity
}

function placeColumns(remap: Uint32Array) {
  const placed = placeVariantRows(payload, remap)
  const painted = { ...placed, cellColors }
  return matrixShader.packInstances(
    {
      featureIndex: painted.cellFeatureIndices,
      row: painted.cellRowIndices,
      color: painted.cellColors,
    },
    painted.numCells,
  )
}

function placeColumnsControl(remap: Uint32Array) {
  const placed = placeVariantRows(payload, remap)
  const painted = { ...placed, cellColors }
  return matrixShader.packInstances(
    {
      featureIndex: painted.cellFeatureIndices,
      row: painted.cellRowIndices,
      color: painted.cellColors,
    },
    painted.numCells,
  )
}

function placeGenomic(remap: Uint32Array) {
  const placed = placeVariantRows(payload, remap)
  const painted = { ...placed, cellColors, cellPositions, cellShapeTypes }
  return cellShader.packInstances(
    {
      startEnd: painted.cellPositions,
      row: painted.cellRowIndices,
      shapeType: painted.cellShapeTypes,
      color: painted.cellColors,
    },
    painted.numCells,
  )
}

function table(remap: Uint32Array) {
  return buildRowTable(remap, rowColor)
}

const placed = placeVariantRows(payload, shuffled)
const t = buildRowTable(shuffled, rowColor)
for (let c = 0; c < numCells; c++) {
  if (placed.cellRowIndices[c] !== t.slot[placed.cellWorkerRowIndices[c]!]) {
    throw new Error(
      `identity: cell ${c} placed on a row the table disagrees with`,
    )
  }
}

interface Arm {
  name: string
  run: (remap: Uint32Array) => unknown
  bytes: number
}
const arms: Arm[] = [
  {
    name: 'place-columns',
    run: placeColumns,
    bytes: numCells * matrixShader.INSTANCE_STRIDE_BYTES,
  },
  {
    name: 'place-control',
    run: placeColumnsControl,
    bytes: numCells * matrixShader.INSTANCE_STRIDE_BYTES,
  },
  {
    name: 'place-genomic',
    run: placeGenomic,
    bytes: numCells * cellShader.INSTANCE_STRIDE_BYTES,
  },
  { name: 'table', run: table, bytes: t.texture.bytes.byteLength },
]

const times = new Map(arms.map(a => [a.name, [] as number[]]))
let sink: unknown
for (let round = 0; round < rounds; round++) {
  for (const arm of arms) {
    const remap = nextRemap()
    const t0 = performance.now()
    sink = arm.run(remap)
    times.get(arm.name)!.push(performance.now() - t0)
  }
}
void sink

console.log(
  `${rows} rows x ${features} records = ${numCells.toLocaleString()} cells, ${rounds} rounds, min (median)`,
)
const floor = Math.min(...times.get('place-columns')!)
for (const arm of arms) {
  const sorted = times.get(arm.name)!.toSorted((a, b) => a - b)
  const min = sorted[0]!
  const med = sorted[Math.floor(sorted.length / 2)]!
  console.log(
    `${arm.name.padEnd(16)} ${min.toFixed(2).padStart(8)} ms (${med.toFixed(2)})  x${(min / floor).toFixed(2)}  uploads ${(arm.bytes / 1e6).toFixed(2)} MB`,
  )
}
