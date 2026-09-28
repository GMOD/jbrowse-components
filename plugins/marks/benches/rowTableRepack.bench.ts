// What does a row reorder or a focus cost the mark display under `rows` per
// loaded region, on the main thread, and how many bytes does each gesture
// upload — as the display ran it before the row table, and through the table?
//
//   node plugins/marks/benches/rowTableRepack.bench.ts
//   node plugins/marks/benches/rowTableRepack.bench.ts --rows=1000 --features=50000 --rounds=15
//
// The harness rules — interleave, min-of-rounds, a separately-declared
// control, an identity check before any timing is believed — are in
// agent-docs/reference/BENCHMARKING.md. One process per fixture: quote the
// 100-row and 1000-row numbers from separate runs.
//
// One synthetic region, one `bar` layer: `features` bars dealt across `rows`
// values, each with its hit index. The first three arms are the whole
// main-thread cost of one gesture for that region as the display ran it before
// the table — `facetRegion` moving every layer's rows onto the new layout (and,
// under a focus, filtering every lane and rebuilding the hit index) and the
// pack the upload then runs; the table arms are the same gestures through
// the table, since no region re-keys:
//
//   reorder          the rows permuted
//   reorder-control  the same call through a second driver, the harness's floor
//   focus            half the rows kept, so half the bars drop out
//   table-reorder    the table for the permuted rows
//   table-focus      the table with half the rows hidden, and the region's
//                    scan for the key and extents the legend and axis read
//
// A re-pack arm alternates its gesture with the way back, as the baseline in
// ADR-165 did; a table arm always makes its gesture, since the table holds no
// state and the focus's way back scans nothing.
//
// Beside each time, the bytes the gesture uploads: instance bytes for the
// region on the re-pack arms, the table texture on the table arms. Identity
// first: the rects the painter puts down through the table are the rects the
// re-pack put down, as a multiset, for every gesture.
import { performance } from 'node:perf_hooks'

import { categoricalField } from '@jbrowse/core/util/categoricalField'
import { hitIndexOf } from '@jbrowse/core/util/markEncoding'
import { RowKeys, barMark } from '@jbrowse/render-core/marks'
import { recordingContext } from '@jbrowse/render-core/marks/drawAgainstHit'

import { facetRegion, rowsLayout } from '../src/LinearMarkDisplay/facet.ts'
import {
  drawnKeysOf,
  drawnRegion,
  keyRegion,
  markRowTable,
} from '../src/LinearMarkDisplay/rowTable.ts'

import type { MarkRegionData } from '../src/LinearMarkDisplay/markList.ts'
import type {
  BarChannels,
  BarParams,
  RowTable,
} from '@jbrowse/render-core/marks'

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
    request: {
      adapterConfig: {},
      region: { refName: 'chr1', start: 0, end: n, assemblyName: 'bench' },
      layers: [],
      facet: { field: 'sample' },
    },
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

// The keys never move once the region arrives; the table follows.
const rowKeys = new RowKeys()
const keyed = keyRegion(data, rowKeys, 'sample')
const keyNames = rowKeys.names.slice()

function focusTable(order: readonly string[]) {
  const table = markRowTable(keyNames, order)
  const drawn = drawnKeysOf(table, [keyed], rowKeys, 'sample')
  if (drawn) {
    drawnRegion(keyed, drawn)
  }
  return table
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
const tableReorder = () => {
  bytes = markRowTable(keyNames, shuffled).texture.bytes.byteLength
}
const tableFocus = () => {
  bytes = focusTable(kept).texture.bytes.byteLength
}

const ARMS = [
  { name: 'reorder', run: reorder },
  { name: 'reorder-control', run: reorderControl },
  { name: 'focus', run: focus },
  { name: 'table-reorder', run: tableReorder },
  { name: 'table-focus', run: tableFocus },
]

// identity: the painter through the table puts down the re-pack's rects
const block = {
  displayedRegionIndex: 0,
  start: 0,
  end: data.layers[0]!.x2.reduce((a, b) => Math.max(a, b), 0),
  screenStartPx: 0,
  screenEndPx: 1600,
  reversed: false,
}
const frame = { canvasWidth: 1600, canvasHeight: rows * 4 }
const params: BarParams = {
  domain: [0, 100],
  scaleType: 'linear',
  origin: 0,
  minWidthPx: 0,
  seamPx: 0,
  rowHeight: 4,
}
function rectsOf(region: MarkRegionData, rowTable?: RowTable) {
  const { ctx, calls } = recordingContext()
  barMark.paintBlock(ctx, region.layers[0] as BarChannels, block, frame, {
    ...params,
    rowTable,
  })
  return calls
    .map(r => `${r.x},${r.y},${r.w},${r.h},${String(r.fillStyle)}`)
    .sort()
}
for (const [gesture, layout, order] of [
  ['reorder', layouts.shuffled, shuffled],
  ['focus', layouts.kept, kept],
] as const) {
  const repacked = rectsOf(facetRegion(data, layout))
  const tabled = rectsOf(keyed, markRowTable(keyNames, order))
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
  `\nrounds=${rounds}, ${rows} rows, ${data.layers[0]!.count.toLocaleString()} bars in one region, min per arm`,
)
for (const [i, { name }] of ARMS.entries()) {
  const ms = best[i]!
  console.log(
    `  ${name.padEnd(16)} ${ms.toFixed(3).padStart(9)}ms  ` +
      `${(uploaded[i]! / 1024).toFixed(1).padStart(8)} KiB uploaded  ` +
      `${(ms / best[0]!).toFixed(3)}x reorder`,
  )
}
