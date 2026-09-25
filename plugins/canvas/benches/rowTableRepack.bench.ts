// What does a row reorder, a focus or a recolour cost the multi-row display
// per loaded region, on the main thread, and how many bytes does each gesture
// upload — as the display ran it before the row table, and through the table?
//
//   node plugins/canvas/benches/rowTableRepack.bench.ts
//   node plugins/canvas/benches/rowTableRepack.bench.ts --rows=1000 --features=50000 --rounds=15
//
// The harness rules — interleave, min-of-rounds, a separately-declared
// control, an identity check before any timing is believed — are in
// agent-docs/reference/BENCHMARKING.md. One process per fixture: quote the
// 100-row and 1000-row numbers from separate runs.
//
// One synthetic region: `features` intervals tiling the region, dealt across
// `rows` partition values. The first three arms are the whole main-thread cost
// of one gesture for that region as the display ran it before the table
// (kept here as `repackRegion`, the encode that baked the drawn row and the
// row colour into every instance) and the pack the upload then runs
// (`spanMark.pass.pack`); the table arms are the same gestures through
// `buildRowTable`, which is the whole cost, since no region re-encodes:
//
//   reorder          the rows permuted
//   reorder-control  the same call through a second driver, the harness's floor
//   focus            half the rows kept, so half the features drop out
//   recolour         one row's colour override changed
//   table-reorder    the table for the permuted rows
//   table-focus      the table with half the rows hidden
//   table-recolour   the table with one row's override changed
//
// Beside each time, the bytes the gesture uploads: instance bytes for the
// region on the re-pack arms, the table texture on the table arms. Identity
// first: the rects the painter puts down through the table are the rects the
// re-pack put down, as a multiset, for every gesture.
import { performance } from 'node:perf_hooks'

import {
  HIDDEN_ROW,
  NO_ROW_COLOR,
  RowKeys,
  buildRowTable,
  spanMark,
} from '@jbrowse/render-core/marks'
import { recordingContext } from '@jbrowse/render-core/marks/drawAgainstHit'

import { buildMultiRowChannels } from '../src/LinearMultiRowFeatureDisplay/rendering/multiRowChannels.ts'

import type { MultiRowRegionData } from '../src/LinearMultiRowFeatureDisplay/rendering/multiRowRenderingBackendTypes.ts'
import type { SpanChannels, SpanParams } from '@jbrowse/render-core/marks'

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

interface RepackInputs {
  rowIndexByValue: ReadonlyMap<string, number>
  rowColorsByIndex: readonly (number | undefined)[]
}

// The encode the table retired: the drawn row and the row colour baked into
// every instance, a row outside the order dropped.
function repackRegion(
  {
    featureStarts,
    featureEnds,
    featureColors,
    featurePartitionIndex,
  }: MultiRowRegionData,
  { rowIndexByValue, rowColorsByIndex }: RepackInputs,
): SpanChannels {
  const rowForLocal = data.partitionValues.map(v => rowIndexByValue.get(v))
  const n = featureStarts.length
  const x = new Uint32Array(n)
  const x2 = new Uint32Array(n)
  const row = new Uint32Array(n)
  const color = new Uint32Array(n)
  let count = 0
  for (let i = 0; i < n; i++) {
    const rowIndex = rowForLocal[featurePartitionIndex[i]!]
    if (rowIndex === undefined) {
      continue
    }
    x[count] = featureStarts[i]!
    x2[count] = featureEnds[i]!
    row[count] = rowIndex
    color[count] = rowColorsByIndex[rowIndex] ?? featureColors[i]!
    count++
  }
  return { x, x2, row, color, count }
}

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
  }
}
function focusInputs() {
  flip ^= 1
  return {
    rowIndexByValue: orderOf(flip ? kept : names),
    rowColorsByIndex: colors,
  }
}
let tint = 0
function recolourInputs() {
  tint += 1
  const recoloured = colors.slice()
  recoloured[0] = 0xff000000 | (tint & 0xffffff)
  return { rowIndexByValue: orderOf(names), rowColorsByIndex: recoloured }
}

// The table for the same gesture: the keys never move, the table follows.
const rowKeys = new RowKeys()
const keyed = buildMultiRowChannels(data, {
  rowKeys,
  overriddenRows: new Set<string>(),
  hiddenColors: new Set<number>(),
})
function tableOf({ rowIndexByValue, rowColorsByIndex }: RepackInputs) {
  const slot = new Uint32Array(rowKeys.size).fill(HIDDEN_ROW)
  const color = new Uint32Array(rowKeys.size)
  for (const [name, i] of rowIndexByValue) {
    const key = rowKeys.keyOf(name)
    slot[key] = i
    color[key] = rowColorsByIndex[i] ?? NO_ROW_COLOR
  }
  return buildRowTable(slot, color)
}

// One driver per arm, written out longhand: a shared driver makes the call
// site polymorphic and hands every arm one set of inline caches.
let bytes = 0
const reorder = () => {
  bytes = spanMark.pass.pack(repackRegion(data, reorderInputs())).byteLength
}
const reorderControl = () => {
  bytes = spanMark.pass.pack(repackRegion(data, reorderInputs())).byteLength
}
const focus = () => {
  bytes = spanMark.pass.pack(repackRegion(data, focusInputs())).byteLength
}
const recolour = () => {
  bytes = spanMark.pass.pack(repackRegion(data, recolourInputs())).byteLength
}
const tableReorder = () => {
  bytes = tableOf(reorderInputs()).texture.bytes.byteLength
}
const tableFocus = () => {
  bytes = tableOf(focusInputs()).texture.bytes.byteLength
}
const tableRecolour = () => {
  bytes = tableOf(recolourInputs()).texture.bytes.byteLength
}

const ARMS = [
  { name: 'reorder', run: reorder },
  { name: 'reorder-control', run: reorderControl },
  { name: 'focus', run: focus },
  { name: 'recolour', run: recolour },
  { name: 'table-reorder', run: tableReorder },
  { name: 'table-focus', run: tableFocus },
  { name: 'table-recolour', run: tableRecolour },
]

// identity: the painter through the table puts down the re-pack's rects
const block = {
  displayedRegionIndex: 0,
  start: 0,
  end: data.featureEnds[data.featureEnds.length - 1]!,
  screenStartPx: 0,
  screenEndPx: 1600,
  reversed: false,
}
const frame = { canvasWidth: 1600, canvasHeight: rows * 4 }
const params: SpanParams = {
  rowHeight: 4,
  rowProportion: 1,
  minWidthPx: 2,
  seamPx: 0,
  scrollTop: 0,
}
function rectsOf(channels: SpanChannels, rowTable?: SpanParams['rowTable']) {
  const { ctx, calls } = recordingContext()
  spanMark.paintBlock(ctx, channels, block, frame, { ...params, rowTable })
  return calls
    .map(r => `${r.x},${r.y},${r.w},${r.h},${String(r.fillStyle)}`)
    .sort()
}
for (const [gesture, inputs] of [
  ['reorder', { rowIndexByValue: orderOf(shuffled), rowColorsByIndex: colors }],
  ['focus', { rowIndexByValue: orderOf(kept), rowColorsByIndex: colors }],
  ['recolour', recolourInputs()],
] as const) {
  const repacked = rectsOf(repackRegion(data, inputs))
  const tabled = rectsOf(keyed, tableOf(inputs))
  if (repacked.length !== tabled.length) {
    throw new Error(
      `${gesture}: the table painted ${tabled.length} rects, the re-pack ${repacked.length}`,
    )
  }
  const at = repacked.findIndex((r, i) => r !== tabled[i])
  if (at !== -1) {
    throw new Error(
      `${gesture}: rect ${at} differs — re-pack ${repacked[at]}, table ${tabled[at]}`,
    )
  }
  console.log(`${gesture}: ${tabled.length} rects match the re-pack`)
}

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
  `\nrounds=${rounds}, ${rows} rows, ${data.featureStarts.length.toLocaleString()} features in one region, min per arm`,
)
for (const [i, { name }] of ARMS.entries()) {
  const ms = best[i]!
  console.log(
    `  ${name.padEnd(16)} ${ms.toFixed(3).padStart(9)}ms  ` +
      `${(uploaded[i]! / 1024).toFixed(1).padStart(8)} KiB uploaded  ` +
      `${(ms / best[0]!).toFixed(3)}x reorder`,
  )
}
