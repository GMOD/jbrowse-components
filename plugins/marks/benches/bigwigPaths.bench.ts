import { rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
// The mark display beside the wiggle display over one BigWig: the worker work
// each path does for one region at one zoom, over the same tier bbi picks for
// both (ADR-125), and how far a binned `mean` over a summary tier sits from
// the raw section it summarises.
//
//   node --experimental-transform-types plugins/marks/benches/bigwigPaths.bench.ts
//   node --experimental-transform-types plugins/marks/benches/bigwigPaths.bench.ts --file=/path/to/big.bw --refName=chr2 --rounds=9
//
// Transform types rather than strip them: the hover check reaches render-core's
// marks barrel, whose line mark declares a parameter property.
//
// Flags: --file (default test_data/volvox/volvox_microarray.bw), --refName
// (default the header's first), --start (default 0), --screenPx (default
// 1500: each zoom fetches one screen of that width from --start, clamped to
// the contig, which is what a display's region fetch is), --zooms=<bp/px,...>
// (default one zoom inside each tier of the file, the raw section included),
// --rounds (default 7), --index (the marks arms with the hit index a bar
// asked for before ADR-196), --base=<ref> (an eighth arm, table-base: the
// table arm through packages/core extracted at that ref), --json.
//
// Seven arms per zoom, interleaved round-robin with the order rotated each
// round, MIN across rounds
// (agent-docs/reference/BENCHMARKING.md), each a fetch plus what the RPC
// executor does with it:
//
//   wiggle      getFeatureArraysMulti, then processFeaturesFromArrays — the
//               RenderWiggleData executor's work for one region
//   control     the same, declared a second time
//   marks       getFeaturesArray, then encodeFeatures over the bar mark's
//               lanes — the CoreGetEncodedLayers executor's work for
//               `{ mark: 'bar', encoding: { y: 'score' } }`
//   marks-mean  the same fetch through `bin: auto` and `aggregate: mean` first,
//               which is what a density-style declaration costs on top
//   table       getFeatureTable, the adapter's rows as a table over bbi's
//               arrays, then the same encode: what CoreGetEncodedLayers runs
//   table-mean  the same table through `bin: auto` and `aggregate: mean`
//   table-weighted  the same table through `bin: auto` over `fields`, each row
//               cut at the bin edges, and a mean weighted by `overlap`
//   table-base  with --base, the table arm's encode as the ref spells it, its
//               lanes checked equal to the table arm's first
//
// The bbi block cache is warm after the first round, so the MIN is a refetch
// over held blocks: the zoom-across-a-tier case, not a cold open.
//
// Identity: the wiggle arm's positions and scores are compared against the
// marks arm's x/x2/y before any time is believed, since both are supposed to
// be the same tier rows.
//
// The hover: over the table arm's bars, the display's first hover builds
// `rowSpanIndex` on the main thread, timed beside the Flatbush `hitIndexOf`
// builds over the same lanes, which a bar asked the worker for before ADR-196.
// `findMarkHit` by rows must answer what it answers through that Flatbush at
// 5000 random hovers over the screen, and the mean time of one hover each way
// prints beside it.
//
// The bytes: what each path's payload holds a row once the RPC returns — the
// unique buffers under wiggle's arrays and under the table arm's lanes, as
// `rpcDataMap` retains them — per row.
//
// The error rows: for a summary tier, `aggregate: mean` over `bin: auto` is
// a mean of tier means, unweighted, since bbi exports no validCnt. Against
// the raw section's coverage-weighted mean over the same bins, the bench
// reports the unweighted error and the table-weighted arm's, as a percentage
// of the raw score range. The gap between those two is the most a validCnt
// could buy.
import { performance } from 'node:perf_hooks'

import { aggregateFieldName } from '@jbrowse/core/util/aggregateFieldName'
import { runTransforms } from '@jbrowse/core/util/featureTransforms'
import createJexlInstance from '@jbrowse/core/util/jexl'
import {
  colorAt,
  encodeFeatures,
  hitIndexOf,
} from '@jbrowse/core/util/markEncoding'
import {
  barMark,
  defineMark,
  rowSpanIndex,
  withPassId,
} from '@jbrowse/render-core/marks'

import { checkoutPackageAtRef } from '../../maf/benches/refCheckout.ts'
import BigWigAdapter from '../../wiggle/src/BigWigAdapter/BigWigAdapter.ts'
import configSchema from '../../wiggle/src/BigWigAdapter/configSchema.ts'
import { tierSpanRange } from '../../wiggle/src/BigWigAdapter/tierSpanRange.ts'
import { processFeaturesFromArrays } from '../../wiggle/src/util.ts'
import { autoBinStep } from '../src/LinearMarkDisplay/autoBin.ts'
import { findMarkHit } from '../src/LinearMarkDisplay/findMarkHit.ts'

import type {
  DisplayMark,
  MarkRegionData,
  MarkRenderState,
  StoredLayer,
} from '../src/LinearMarkDisplay/markList.ts'
import type { Feature } from '@jbrowse/core/util'
import type { FeatureTable } from '@jbrowse/core/util/featureTable'
import type {
  EncodedChannels,
  LaneName,
  TransformStep,
} from '@jbrowse/core/util/markEncoding'
import type { AugmentedRegion as Region } from '@jbrowse/core/util/types'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

const flag = (name: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1]
const num = (name: string, fallback: number) => Number(flag(name) ?? fallback)

const file = resolve(flag('file') ?? 'test_data/volvox/volvox_microarray.bw')
const rounds = num('rounds', 7)
const asJson = process.argv.includes('--json')
const baseRef = flag('base')
const baseDir = baseRef
  ? checkoutPackageAtRef(
      resolve(import.meta.dirname, '../../..'),
      baseRef,
      'packages/core',
    )
  : undefined
const encodeBase: typeof encodeFeatures | undefined = baseDir
  ? (await import(join(baseDir, 'packages/core/src/util/markEncoding.ts')))
      .encodeFeatures
  : undefined

const adapter = new BigWigAdapter(
  configSchema.create({
    bigWigLocation: { localPath: file, locationType: 'LocalPathLocation' },
  }),
)
const { header, firstLevel } = await adapter.setup()
const levels = await adapter.getReductionLevels()
const refName = flag('refName') ?? Object.keys(header.refsByName)[0]!
const refInfo = header.refsByNumber[header.refsByName[refName]!]!
const start = num('start', 0)
const screenPx = num('screenPx', 1500)
function screenAt(bpPerPx: number): Region {
  return {
    refName,
    start,
    end: Math.min(refInfo.length, Math.round(start + bpPerPx * screenPx)),
    assemblyName: 'bench',
  }
}

// one zoom inside each tier, synthetic ones included: the geometric middle of
// the range it serves, the raw section at a quarter of its ceiling, the top
// tier at its floor x2
const zooms = flag('zooms')
  ? flag('zooms')!.split(',').map(Number)
  : [
      levels[0]! / 4,
      ...levels.map((l, i) => {
        const hi = levels[i + 1]
        return hi === undefined ? l : Math.sqrt((l / 2) * (hi / 2))
      }),
    ]

const jexl = createJexlInstance()
// markLanes('bar'), spelled here because markList.ts reaches React
const BAR_LANES: LaneName[] = process.argv.includes('--index')
  ? ['y', 'color', 'colorValue', 'index']
  : ['y', 'color', 'colorValue']

function meanSteps(bpPerPx: number): TransformStep[] {
  return [
    { type: 'bin', step: autoBinStep(bpPerPx) },
    {
      type: 'aggregate',
      groupby: ['start', 'end'],
      ops: [{ op: 'mean', field: 'score' }],
    },
  ]
}
const MEAN_FIELD = aggregateFieldName({ op: 'mean', field: 'score' })

// Each tier row cut at the bin edges and its score weighted by the bases it
// puts in each bin: a mean per base of the tier's rows.
function weightedSteps(bpPerPx: number): TransformStep[] {
  return [
    { type: 'bin', step: autoBinStep(bpPerPx), fields: ['start', 'end'] },
    {
      type: 'aggregate',
      groupby: ['start', 'end'],
      ops: [{ op: 'mean', field: 'score', weight: 'overlap' }],
    },
  ]
}

// One driver per arm, written out rather than shared, so no call site goes
// polymorphic across arms.
function armWiggle(region: Region, bpPerPx: number) {
  return async () => {
    const raws = await adapter.getFeatureArraysMulti([region], { bpPerPx })
    return processFeaturesFromArrays(raws[0]!)
  }
}
function armControl(region: Region, bpPerPx: number) {
  return async () => {
    const raws = await adapter.getFeatureArraysMulti([region], { bpPerPx })
    return processFeaturesFromArrays(raws[0]!)
  }
}
function armMarks(region: Region, bpPerPx: number) {
  return async () => {
    const features = await adapter.getFeaturesArray(region, { bpPerPx })
    return encodeFeatures(features, { y: 'score' }, BAR_LANES, { jexl })
  }
}
function armMarksMean(region: Region, bpPerPx: number) {
  const steps = meanSteps(bpPerPx)
  return async () => {
    const features = await adapter.getFeaturesArray(region, { bpPerPx })
    const binned = runTransforms(features, steps, jexl)
    return encodeFeatures(binned, { y: MEAN_FIELD }, BAR_LANES, { jexl })
  }
}

function armTable(region: Region, bpPerPx: number) {
  return async () => {
    const table = await adapter.getFeatureTable(region, { bpPerPx })
    return encodeFeatures(table, { y: 'score' }, BAR_LANES, { jexl })
  }
}
function armTableMean(region: Region, bpPerPx: number) {
  const steps = meanSteps(bpPerPx)
  return async () => {
    const table = await adapter.getFeatureTable(region, { bpPerPx })
    const binned = runTransforms(table, steps, jexl)
    return encodeFeatures(binned, { y: MEAN_FIELD }, BAR_LANES, { jexl })
  }
}
function armTableWeighted(region: Region, bpPerPx: number) {
  const steps = weightedSteps(bpPerPx)
  return async () => {
    const table = await adapter.getFeatureTable(region, { bpPerPx })
    const binned = runTransforms(table, steps, jexl)
    return encodeFeatures(binned, { y: MEAN_FIELD }, BAR_LANES, { jexl })
  }
}

function armTableBase(region: Region, bpPerPx: number) {
  return async () => {
    const table = await adapter.getFeatureTable(region, { bpPerPx })
    return encodeBase!(table, { y: 'score' }, BAR_LANES, { jexl })
  }
}

function tierLabel(bpPerPx: number) {
  const [lo] = tierSpanRange(levels, bpPerPx)
  const reduction = lo * 2
  return lo === 0
    ? 'raw'
    : reduction < firstLevel
      ? `${reduction} (synthetic)`
      : String(reduction)
}

interface RawRows {
  starts: ArrayLike<number>
  ends: ArrayLike<number>
  scores: ArrayLike<number>
  count: number
}

// `aggregate: mean` over `bin: auto` against the raw section, per bin, and
// the declared weighted mean against it over the same bins
function meanOfMeansError(
  tier: readonly Feature[],
  weighted: FeatureTable,
  raw: RawRows,
  binBp: number,
) {
  const unweighted = new Map<number, { sum: number; n: number }>()
  for (const f of tier) {
    const b = Math.floor(f.get('start') / binBp)
    const u = unweighted.get(b) ?? { sum: 0, n: 0 }
    u.sum += f.get('score')!
    u.n += 1
    unweighted.set(b, u)
  }
  const declared = new Map<number, number>()
  for (let i = 0; i < weighted.length; i++) {
    const f = weighted.row(i)
    declared.set(f.get('start') / binBp, f.get(MEAN_FIELD) as number)
  }
  const truth = new Map<number, { sum: number; w: number }>()
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < raw.count; i++) {
    const start = raw.starts[i]!
    const end = raw.ends[i]!
    const score = raw.scores[i]!
    min = Math.min(min, score)
    max = Math.max(max, score)
    for (let b = Math.floor(start / binBp); b * binBp < end; b++) {
      const overlap =
        Math.min(end, (b + 1) * binBp) - Math.max(start, b * binBp)
      const t = truth.get(b) ?? { sum: 0, w: 0 }
      t.sum += score * overlap
      t.w += overlap
      truth.set(b, t)
    }
  }
  const range = max - min
  let bins = 0
  let sumU = 0
  let maxU = 0
  let sumW = 0
  for (const [b, t] of truth) {
    const u = unweighted.get(b)
    const w = declared.get(b)
    if (!u || w === undefined) {
      continue
    }
    bins++
    const target = t.sum / t.w
    const errU = Math.abs(u.sum / u.n - target)
    const errW = Math.abs(w - target)
    sumU += errU
    maxU = Math.max(maxU, errU)
    sumW += errW
  }
  return {
    bins,
    meanErrPct: (sumU / bins / range) * 100,
    maxErrPct: (maxU / range) * 100,
    weightedErrPct: (sumW / bins / range) * 100,
  }
}

function barMarkOf(hitBy: DisplayMark['hitBy']): DisplayMark {
  const mark = defineMark({
    shape: withPassId(barMark, 'bar#0'),
    channels: (d: MarkRegionData) => d.layers[0] as never,
    params: (s: MarkRenderState) => ({
      domain: s.domainY,
      scaleType: s.scaleTypeY,
      symlogConstant: s.symlogConstantY,
      origin: s.origin,
      minWidthPx: s.minWidthPx,
      seamPx: 0,
      rowHeight: s.rowHeight,
      rowOffsetPx: -s.scrollTop,
    }),
  })
  return Object.assign(mark, { markIndex: 0, hitBy })
}

function uniqueBytes(views: (ArrayBufferView | undefined)[]) {
  const seen = new Set<ArrayBufferLike>()
  let bytes = 0
  for (const view of views) {
    if (view && !seen.has(view.buffer)) {
      seen.add(view.buffer)
      bytes += view.buffer.byteLength
    }
  }
  return bytes
}

function encodedBytes(c: EncodedChannels) {
  return uniqueBytes([
    c.x,
    c.x2,
    c.featureIndex,
    c.y,
    c.row,
    typeof c.color === 'number' ? undefined : c.color,
    c.colorValue,
    c.glyph,
  ])
}

function minMs(run: () => unknown) {
  let best = Infinity
  for (let r = 0; r < rounds; r++) {
    const t0 = performance.now()
    run()
    best = Math.min(best, performance.now() - t0)
  }
  return best
}

// The bars' hover by rows against the same through a Flatbush, over one
// screen of the region: identical answers first, then the builds and one
// hover's mean each way.
function hoverCheck(bars: EncodedChannels, region: Region, bpPerPx: number) {
  const layer = bars as StoredLayer
  const { x, x2, y, count } = layer
  const widthPx = (region.end - region.start) / bpPerPx
  const block: RenderBlock = {
    displayedRegionIndex: 0,
    start: region.start,
    end: region.end,
    screenStartPx: 0,
    screenEndPx: widthPx,
    reversed: false,
  }
  const state: MarkRenderState = {
    domainY: [Math.min(0, layer.yMin), Math.max(0, layer.yMax)],
    scaleTypeY: 'linear',
    symlogConstantY: 1,
    colorScales: [],
    canvasWidth: widthPx,
    canvasHeight: 100,
    bpPerPx,
    origin: 0,
    minWidthPx: 0,
    markSizes: [0],
    sizeScales: [],
    linkRegions: [],
    valueInsetPx: 0,
    rowHeight: 100,
    rowProportions: [1],
    scrollTop: 0,
  }
  const flatbushMs = minMs(() => hitIndexOf(x, x2, y, count))
  const rowIndexMs = minMs(() => rowSpanIndex(x, x2, undefined, count))
  const byRows = new Map([[0, { layers: [layer] }]])
  const indexed = new Map([
    [0, { layers: [{ ...layer, flatbush: hitIndexOf(x, x2, y, count) }] }],
  ])
  const rowMarks = [barMarkOf('rows')]
  const indexMarks = [barMarkOf('index')]
  const probes = 5000
  let seed = 7
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }
  const points = Array.from({ length: probes }, () => [
    rand() * widthPx,
    rand() * 100,
  ])
  const hover = (
    data: typeof byRows,
    marks: DisplayMark[],
    [px, py]: number[],
  ) => findMarkHit(px!, py!, [block], data, marks, state, [region])
  let hits = 0
  for (const p of points) {
    const got = hover(byRows, rowMarks, p)
    const want = hover(indexed, indexMarks, p)
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      throw new Error(
        `${bpPerPx} bp/px at ${p.join(',')}: by rows ${JSON.stringify(got)}, through the Flatbush ${JSON.stringify(want)}`,
      )
    }
    hits += got ? 1 : 0
  }
  const perHover = (data: typeof byRows, marks: DisplayMark[]) =>
    (minMs(() => {
      for (const p of points) {
        hover(data, marks, p)
      }
    }) *
      1000) /
    probes
  return {
    probes,
    hits,
    flatbushMs: Number(flatbushMs.toFixed(2)),
    rowIndexMs: Number(rowIndexMs.toFixed(2)),
    rowHoverUs: Number(perHover(byRows, rowMarks).toFixed(2)),
    indexHoverUs: Number(perHover(indexed, indexMarks).toFixed(2)),
  }
}

const results = []
for (const bpPerPx of zooms) {
  const region = screenAt(bpPerPx)
  const arms = [
    ['wiggle', armWiggle(region, bpPerPx)],
    ['control', armControl(region, bpPerPx)],
    ['marks', armMarks(region, bpPerPx)],
    ['marks-mean', armMarksMean(region, bpPerPx)],
    ['table', armTable(region, bpPerPx)],
    ['table-mean', armTableMean(region, bpPerPx)],
    ['table-weighted', armTableWeighted(region, bpPerPx)],
    ...(encodeBase
      ? [['table-base', armTableBase(region, bpPerPx)] as const]
      : []),
  ] as const

  const wiggle = await arms[0][1]()
  const marks = await arms[2][1]()
  const table = await arms[4][1]()
  if (wiggle.numFeatures !== marks.count || table.count !== marks.count) {
    throw new Error(
      `${bpPerPx} bp/px: wiggle holds ${wiggle.numFeatures} rows, marks ${marks.count}`,
    )
  }
  for (let i = 0; i < marks.count; i++) {
    if (
      wiggle.featurePositions[i * 2] !== marks.x[i] ||
      wiggle.featurePositions[i * 2 + 1] !== marks.x2[i] ||
      wiggle.featureScores[i] !== marks.y[i] ||
      table.x[i] !== marks.x[i] ||
      table.x2[i] !== marks.x2[i] ||
      table.y[i] !== marks.y[i]
    ) {
      throw new Error(`${bpPerPx} bp/px: row ${i} differs between the paths`)
    }
  }

  const tableBase = encodeBase
    ? await armTableBase(region, bpPerPx)()
    : undefined
  if (tableBase) {
    for (let i = 0; i < table.count; i++) {
      if (
        tableBase.x[i] !== table.x[i] ||
        tableBase.x2[i] !== table.x2[i] ||
        tableBase.y[i] !== table.y[i] ||
        colorAt(tableBase, i) !== colorAt(table, i)
      ) {
        throw new Error(`${bpPerPx} bp/px: row ${i} differs from ${baseRef}`)
      }
    }
  }

  const best = arms.map(() => Infinity)
  for (let r = 0; r < rounds; r++) {
    for (let k = 0; k < arms.length; k++) {
      const i = (k + r) % arms.length
      const t0 = performance.now()
      await arms[i]![1]()
      best[i] = Math.min(best[i]!, performance.now() - t0)
    }
  }

  const wiggleBytes = uniqueBytes([
    wiggle.featurePositions,
    wiggle.featureScores,
    wiggle.featureMinScores,
    wiggle.featureMaxScores,
  ])
  const hover = hoverCheck(table, region, bpPerPx)
  const tier = tierLabel(bpPerPx)
  const binBp = autoBinStep(bpPerPx)
  const error =
    tier === 'raw'
      ? undefined
      : meanOfMeansError(
          await adapter.getFeaturesArray(region, { bpPerPx }),
          runTransforms(
            await adapter.getFeatureTable(region, { bpPerPx }),
            weightedSteps(bpPerPx),
            jexl,
          ),
          await adapter.getFeatureArrays(region, { bpPerPx: 0 }),
          binBp,
        )
  results.push({
    bpPerPx: Number(bpPerPx.toFixed(1)),
    tier,
    regionBp: region.end - region.start,
    rows: marks.count,
    wiggleMs: Number(best[0]!.toFixed(2)),
    controlMs: Number(best[1]!.toFixed(2)),
    marksMs: Number(best[2]!.toFixed(2)),
    marksMeanMs: Number(best[3]!.toFixed(2)),
    tableMs: Number(best[4]!.toFixed(2)),
    tableMeanMs: Number(best[5]!.toFixed(2)),
    tableWeightedMs: Number(best[6]!.toFixed(2)),
    binBp,
    wiggleBytesPerRow: Number((wiggleBytes / marks.count).toFixed(2)),
    tableBytesPerRow: Number((encodedBytes(table) / marks.count).toFixed(2)),
    ...(tableBase
      ? {
          tableBaseMs: Number(best[7]!.toFixed(2)),
          tableBaseBytesPerRow: Number(
            (encodedBytes(tableBase) / marks.count).toFixed(2),
          ),
        }
      : {}),
    hover,
    ...(error
      ? {
          bins: error.bins,
          meanErrPct: Number(error.meanErrPct.toFixed(2)),
          maxErrPct: Number(error.maxErrPct.toFixed(2)),
          weightedErrPct: Number(error.weightedErrPct.toFixed(2)),
        }
      : {}),
  })
}

if (asJson) {
  console.log(
    JSON.stringify({ file, refName, start, screenPx, results }, null, 2),
  )
} else {
  console.log(
    `${file}\n${refName} from ${start}, ${screenPx}px screens, tiers ${levels.join(', ')}, rounds=${rounds}, min per arm\n`,
  )
  for (const r of results) {
    const error =
      r.bins === undefined
        ? ''
        : `  bin ${r.binBp}bp x${r.bins}: mean-of-means err ${r.meanErrPct}% mean, ${r.maxErrPct}% max; declared weighted ${r.weightedErrPct}%`
    const h = r.hover
    console.log(
      `  ${String(r.bpPerPx).padStart(9)} bp/px  retained a row: wiggle ${r.wiggleBytesPerRow}B, table ${r.tableBytesPerRow}B${r.tableBaseMs === undefined ? '' : `; table-base ${r.tableBaseBytesPerRow}B in ${r.tableBaseMs}ms (${(r.tableBaseMs / r.wiggleMs).toFixed(2)}x)`}`,
    )
    console.log(
      `  ${String(r.bpPerPx).padStart(9)} bp/px  hover: ${h.hits}/${h.probes} hits agree; Flatbush build ${h.flatbushMs}ms, row index ${h.rowIndexMs}ms; a hover ${h.indexHoverUs}us through the Flatbush, ${h.rowHoverUs}us by rows`,
    )
    console.log(
      `  ${String(r.bpPerPx).padStart(9)} bp/px  tier ${r.tier.padEnd(9)} ${String(r.regionBp).padStart(10)}bp rows ${String(r.rows).padStart(7)}  wiggle ${r.wiggleMs.toFixed(2).padStart(7)}ms  control ${r.controlMs.toFixed(2).padStart(7)}ms  marks ${r.marksMs.toFixed(2).padStart(7)}ms (${(r.marksMs / r.wiggleMs).toFixed(2)}x)  marks-mean ${r.marksMeanMs.toFixed(2).padStart(7)}ms  table ${r.tableMs.toFixed(2).padStart(7)}ms (${(r.tableMs / r.wiggleMs).toFixed(2)}x)  table-mean ${r.tableMeanMs.toFixed(2).padStart(7)}ms  table-weighted ${r.tableWeightedMs.toFixed(2).padStart(7)}ms${error}`,
    )
  }
}

if (baseDir) {
  rmSync(baseDir, { recursive: true, force: true })
}
