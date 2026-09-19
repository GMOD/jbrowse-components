import { resolve } from 'node:path'
// What a multiwiggle region costs in instance bytes and main-thread encode, on
// the real path: BigWig arrays -> processFeaturesFromArrays ->
// buildSourceRenderData -> the production packers, beside the prototypes in
// prototypePackers.ts.
//
//   node --experimental-transform-types --expose-gc \
//     plugins/wiggle/benches/instanceBuffer.bench.ts \
//     --file=/path/a.bw --refName=chr2 --start=130000000 --bpPerPx=319
//
// Flags: --file (comma list; sources cycle over the files' arrays), --refName,
// --start, --bpPerPx, --screenPx (1500), --sources (1000), --rounds (9),
// --sign=keep|positive|signed (positive takes |score|; signed subtracts the
// median, so both signs share one geometry), --paintSources (100, Canvas2D
// arms), --json.
//
// Arms are interleaved in a fresh random order each round with a GC ahead of
// each, MIN across rounds, one function literal per arm (agent-docs/reference/
// BENCHMARKING.md). `*-control` arms call the baseline through a second driver
// literal; a control far from its baseline means the run resolved nothing.
// Prototype packers are checked field-by-field against the production buffer
// before any time is printed.
import { performance } from 'node:perf_hooks'

import { normalizedRgbToABGR } from '@jbrowse/core/util/colorBits'
import { SCALE_TYPE_LINEAR } from '@jbrowse/render-core/scoreScale'
import { createCanvas } from 'canvas'

import BigWigAdapter from '../src/BigWigAdapter/BigWigAdapter.ts'
import configSchema from '../src/BigWigAdapter/configSchema.ts'
import { buildSourceRenderData } from '../src/shared/buildSourceRenderData.ts'
import {
  INSTANCE_OFFSET_F32 as STEP_F32,
  INSTANCE_OFFSET_U32 as STEP_U32,
  INSTANCE_STRIDE_WORDS as STEP_WORDS,
} from '../src/shared/shaders/wiggleLine.iface.generated.ts'
import {
  INSTANCE_OFFSET_F32 as CENTER_F32,
  INSTANCE_OFFSET_U32 as CENTER_U32,
  INSTANCE_STRIDE_WORDS as CENTER_WORDS,
} from '../src/shared/shaders/wiggleLineCenter.iface.generated.ts'
import { drawLine, drawLineCenter } from '../src/shared/wiggleDrawFunctions.ts'
import {
  packBandInstances,
  packFillInstances,
  packLineCenterInstances,
  packLineInstances,
} from '../src/shared/wiggleInstanceBuffer.ts'
import {
  processFeaturesFromArrays,
  WIGGLE_NEG_COLOR_DEFAULT,
  WIGGLE_POS_COLOR_DEFAULT,
} from '../src/util.ts'
import {
  buildRowColorTable,
  packBand36,
  packCenterLine28,
  packFill16,
  packStepLine24,
} from './prototypePackers.ts'

import type { WiggleGpuProps } from '../src/shared/buildSourceRenderData.ts'
import type { RawFeatureArrays } from '../src/util.ts'
import type { SourceRenderData, WiggleDataResult } from '@jbrowse/wiggle-core'

const flag = (name: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1]
const num = (name: string, fallback: number) => Number(flag(name) ?? fallback)

const files = (flag('file') ?? 'test_data/volvox/volvox_microarray.bw')
  .split(',')
  .map(f => resolve(f))
const refNameFlag = flag('refName')
const start = num('start', 0)
const bpPerPx = num('bpPerPx', 667)
const screenPx = num('screenPx', 1500)
const numSources = num('sources', 1000)
const rounds = num('rounds', 9)
const sign = flag('sign') ?? 'keep'
const paintSources = num('paintSources', 100)
const asJson = process.argv.includes('--json')

async function fetchRaw(file: string) {
  const adapter = new BigWigAdapter(
    configSchema.create({
      bigWigLocation: { localPath: file, locationType: 'LocalPathLocation' },
    }),
  )
  const { header } = await adapter.setup()
  const refName = refNameFlag ?? Object.keys(header.refsByName)[0]!
  const len = header.refsByNumber[header.refsByName[refName]!]!.length
  const end = Math.min(len, Math.round(start + bpPerPx * screenPx))
  const [raw] = await adapter.getFeatureArraysMulti(
    [{ refName, start, end, assemblyName: 'bench' }],
    { bpPerPx },
  )
  const { minBpPerPx: lo } = await adapter.getZoomRange({ bpPerPx })
  return {
    raw: raw!,
    refName,
    end,
    tier: lo === 0 ? 'raw' : String(lo * 2),
    firstTier: header.zoomLevels[0]?.reductionLevel ?? 0,
  }
}

function applySign(raw: RawFeatureArrays): RawFeatureArrays {
  if (sign === 'keep') {
    return raw
  }
  const scores = Float32Array.from(raw.scores)
  const mins = raw.minScores ? Float32Array.from(raw.minScores) : undefined
  const maxs = raw.maxScores ? Float32Array.from(raw.maxScores) : undefined
  if (sign === 'positive') {
    for (let i = 0; i < raw.count; i++) {
      scores[i] = Math.abs(scores[i]!)
      if (mins && maxs) {
        const a = Math.abs(mins[i]!)
        const b = Math.abs(maxs[i]!)
        mins[i] = Math.min(a, b)
        maxs[i] = Math.max(a, b)
      }
    }
  } else {
    const median = Float32Array.from(scores).sort()[raw.count >> 1] ?? 0
    for (let i = 0; i < raw.count; i++) {
      scores[i]! -= median
      if (mins && maxs) {
        mins[i]! -= median
        maxs[i]! -= median
      }
    }
  }
  return { ...raw, scores, minScores: mins, maxScores: maxs }
}

const fetched = await Promise.all(files.map(fetchRaw))
const raws = Array.from({ length: numSources }, (_, i) =>
  applySign(fetched[i % fetched.length]!.raw),
)
const first = fetched[0]!
const viewBp = first.end - start
const pivot = 0

const sourceList = raws.map((_, i) => ({ name: `s${i}` }))
function payload(summary: boolean): WiggleDataResult {
  return {
    sources: raws.map((raw, i) => ({
      name: `s${i}`,
      ...processFeaturesFromArrays(
        summary ? raw : { ...raw, minScores: undefined, maxScores: undefined },
      ),
    })),
  }
}
const data = payload(true)
const dataAvg = payload(false)

function props(renderingType: string, mode: string): WiggleGpuProps {
  return {
    sources: sourceList,
    faceted: true,
    posColor: WIGGLE_POS_COLOR_DEFAULT,
    negColor: WIGGLE_NEG_COLOR_DEFAULT,
    effectiveSummaryScoreMode: mode,
    renderingType,
    bicolorPivot: pivot,
    maxGapMultiple: 0,
  }
}
const xyProps = props('xyplot', 'avg')
const lineProps = props('line', 'avg')
const centerProps = props('linecenter', 'avg')
const bandProps = props('line', 'whiskers')

const xyLayers = buildSourceRenderData(dataAvg, xyProps)
const lineLayers = buildSourceRenderData(dataAvg, lineProps)
const centerLayers = buildSourceRenderData(dataAvg, centerProps)
const bandLayers = buildSourceRenderData(data, bandProps)
const hasBand = bandLayers.some(l => l.band)

// ---- identity: every prototype field against the production record ----

function fail(what: string, i: number, a: number, b: number) {
  throw new Error(`${what}: instance ${i} differs (${a} vs ${b})`)
}

function checkFill() {
  const base = packFillInstances(xyLayers)
  const proto = packFill16(xyLayers, pivot)
  const table = buildRowColorTable(xyProps)
  const bu = new Uint32Array(base)
  const bf = new Float32Array(base)
  const pu = new Uint32Array(proto)
  const pf = new Float32Array(proto)
  const n = base.byteLength / 20
  for (let i = 0; i < n; i++) {
    const b = i * 5
    const p = i * 4
    if (bu[b] !== pu[p] || bu[b + 1] !== pu[p + 1]) {
      fail('fill startEnd', i, bu[b]!, pu[p]!)
    }
    if (bf[b + 2] !== pf[p + 2]) {
      fail('fill score', i, bf[b + 2]!, pf[p + 2]!)
    }
    const row = pu[p + 3]! >> 1
    if (bf[b + 4] !== row) {
      fail('fill row', i, bf[b + 4]!, row)
    }
    const color = table[row * 2 + (pu[p + 3]! & 1)]
    if (bu[b + 3] !== color) {
      fail('fill color by table', i, bu[b + 3]!, color!)
    }
  }
}

interface LineRecord {
  words: number
  u32: { startEnd: number; color: number; negColor: number }
  f32: { score: number; rowIndex: number }
}

// Each prototype field is [production word, prototype word, view]; the
// prototype's row word stands in for the production colours and row.
function checkLine(
  what: string,
  base: ArrayBuffer,
  record: LineRecord,
  gpuProps: WiggleGpuProps,
  proto: ArrayBuffer,
  words: number,
  fields: [number, number, 'u' | 'f'][],
  rowWordAt: number,
) {
  const table = buildRowColorTable(gpuProps)
  const bu = new Uint32Array(base)
  const bf = new Float32Array(base)
  const pu = new Uint32Array(proto)
  const pf = new Float32Array(proto)
  const n = base.byteLength / (record.words * 4)
  if (proto.byteLength / (words * 4) !== n) {
    throw new Error(`${what} instance count differs`)
  }
  for (let i = 0; i < n; i++) {
    const b = i * record.words
    const p = i * words
    for (const [bo, po, kind] of fields) {
      const a = kind === 'u' ? bu[b + bo]! : bf[b + bo]!
      const c = kind === 'u' ? pu[p + po]! : pf[p + po]!
      if (a !== c) {
        fail(`${what} word ${bo}`, i, a, c)
      }
    }
    const row = pu[p + rowWordAt]! >> 1
    if (bf[b + record.f32.rowIndex] !== row) {
      fail(`${what} row`, i, bf[b + record.f32.rowIndex]!, row)
    }
    if (bu[b + record.u32.color] !== table[row * 2]) {
      fail(`${what} color`, i, bu[b + record.u32.color]!, table[row * 2]!)
    }
    if (bu[b + record.u32.negColor] !== table[row * 2 + 1]) {
      fail(
        `${what} negColor`,
        i,
        bu[b + record.u32.negColor]!,
        table[row * 2 + 1]!,
      )
    }
  }
}

function checkBand() {
  const base = packBandInstances(bandLayers)
  const proto = packBand36(bandLayers)
  const bu = new Uint32Array(base)
  const bf = new Float32Array(base)
  const pu = new Uint32Array(proto)
  const pf = new Float32Array(proto)
  const n = base.byteLength / 44
  for (let i = 0; i < n; i++) {
    const b = i * 11
    const p = i * 9
    for (let k = 0; k < 4; k++) {
      if (bu[b + k] !== pu[p + k]) {
        fail(`band u${k}`, i, bu[b + k]!, pu[p + k]!)
      }
    }
    for (let k = 4; k < 8; k++) {
      if (!Object.is(bf[b + k], pf[p + k])) {
        fail(`band f${k}`, i, bf[b + k]!, pf[p + k]!)
      }
    }
    if (bf[b + 10] !== pf[p + 8]) {
      fail('band row', i, bf[b + 10]!, pf[p + 8]!)
    }
  }
}

checkFill()
checkLine(
  'step',
  packLineInstances(lineLayers),
  { words: STEP_WORDS, u32: STEP_U32, f32: STEP_F32 },
  lineProps,
  packStepLine24(lineLayers),
  6,
  [
    [STEP_U32.startEnd, 0, 'u'],
    [STEP_U32.startEnd + 1, 1, 'u'],
    [STEP_F32.score, 2, 'f'],
    [STEP_F32.prevScore, 3, 'f'],
    [STEP_F32.nextScore, 4, 'f'],
  ],
  5,
)
checkLine(
  'center',
  packLineCenterInstances(centerLayers),
  { words: CENTER_WORDS, u32: CENTER_U32, f32: CENTER_F32 },
  centerProps,
  packCenterLine28(centerLayers),
  7,
  [
    [CENTER_U32.startEnd, 0, 'u'],
    [CENTER_U32.startEnd + 1, 1, 'u'],
    [CENTER_F32.score, 2, 'f'],
    [CENTER_U32.prevStartEnd, 3, 'u'],
    [CENTER_U32.prevStartEnd + 1, 4, 'u'],
    [CENTER_F32.prevScore, 5, 'f'],
  ],
  6,
)
if (hasBand) {
  checkBand()
}

// ---- memory ----

function uniqueBytes(sources: WiggleDataResult['sources']) {
  const seen = new Set<ArrayBufferLike>()
  let bytes = 0
  for (const s of sources) {
    for (const a of [
      s.featurePositions,
      s.featureScores,
      s.featureMinScores,
      s.featureMaxScores,
    ]) {
      if (!seen.has(a.buffer)) {
        seen.add(a.buffer)
        bytes += a.buffer.byteLength
      }
    }
  }
  return bytes
}
const features = raws.reduce((t, r) => t + r.count, 0)
const negFeatures = raws.reduce(
  (t, r) => t + r.scores.reduce((n, v) => n + (v >= pivot ? 0 : 1), 0),
  0,
)
const MB = 1024 * 1024
const memory = {
  featuresPerSource: Math.round(features / numSources),
  featuresPerPx: +(features / numSources / (viewBp / bpPerPx)).toFixed(2),
  negShare: +(negFeatures / features).toFixed(3),
  wireMB: +(uniqueBytes(data.sources) / MB).toFixed(1),
  fillMB: +(packFillInstances(xyLayers).byteLength / MB).toFixed(1),
  fill16MB: +(packFill16(xyLayers, pivot).byteLength / MB).toFixed(1),
  stepMB: +(packLineInstances(lineLayers).byteLength / MB).toFixed(1),
  step24MB: +(packStepLine24(lineLayers).byteLength / MB).toFixed(1),
  centerMB: +(packLineCenterInstances(centerLayers).byteLength / MB).toFixed(1),
  center28MB: +(packCenterLine28(centerLayers).byteLength / MB).toFixed(1),
  bandMB: hasBand
    ? +(packBandInstances(bandLayers).byteLength / MB).toFixed(1)
    : 0,
  band36MB: hasBand ? +(packBand36(bandLayers).byteLength / MB).toFixed(1) : 0,
  colorTableBytes: buildRowColorTable(xyProps).byteLength,
}

// ---- Canvas2D ----

const paintLayers = lineLayers.filter(l => l.rowIndex < paintSources)
const paintCenterLayers = centerLayers.filter(l => l.rowIndex < paintSources)
const rowHeight = 20
const canvas = createCanvas(screenPx, paintSources * rowHeight)
const ctx = canvas.getContext('2d') as never
let domainMin = Infinity
let domainMax = -Infinity
for (const r of raws.slice(0, paintSources)) {
  for (let i = 0; i < r.count; i++) {
    domainMin = Math.min(domainMin, r.scores[i]!)
    domainMax = Math.max(domainMax, r.scores[i]!)
  }
}
const block = {
  start,
  end: first.end,
  screenStartPx: 0,
  screenEndPx: screenPx,
  reversed: false,
  displayedRegionIndex: 0,
}
const noopCtx = {
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  lineCap: 'butt',
  lineJoin: 'miter',
  beginPath() {},
  moveTo() {},
  lineTo() {},
  stroke() {},
  fill() {},
} as never
const POS = 'rgb(0,104,209)'
const NEG = 'rgb(224,30,38)'
function rowArgs(c: never, layer: SourceRenderData) {
  return {
    ctx: c,
    source: layer,
    block,
    rowHeight,
    rowTop: layer.rowIndex * rowHeight,
    domainY: [Math.min(0, domainMin), domainMax] as [number, number],
    scaleType: SCALE_TYPE_LINEAR,
    symlogConstant: 1,
    origin: pivot,
    lineWidth: 1,
  }
}

// ---- arms: one literal each, deliberately not shared ----

let sink = 0
const arms: Record<string, () => void> = {
  worker: () => {
    for (const r of raws) {
      sink += processFeaturesFromArrays(r).numFeatures
    }
  },
  'build-xy': () => {
    sink += buildSourceRenderData(dataAvg, xyProps).length
  },
  'build-line': () => {
    sink += buildSourceRenderData(dataAvg, lineProps).length
  },
  'pack-fill': () => {
    sink += packFillInstances(xyLayers).byteLength
  },
  'pack-fill-control': () => {
    sink += packFillInstances(xyLayers).byteLength
  },
  'pack-fill16+table': () => {
    sink +=
      packFill16(xyLayers, pivot).byteLength +
      buildRowColorTable(xyProps).byteLength
  },
  'pack-step': () => {
    sink += packLineInstances(lineLayers).byteLength
  },
  'pack-step-control': () => {
    sink += packLineInstances(lineLayers).byteLength
  },
  'pack-step24+table': () => {
    sink +=
      packStepLine24(lineLayers).byteLength +
      buildRowColorTable(lineProps).byteLength
  },
  'pack-center': () => {
    sink += packLineCenterInstances(centerLayers).byteLength
  },
  'pack-center-control': () => {
    sink += packLineCenterInstances(centerLayers).byteLength
  },
  'pack-center28+table': () => {
    sink +=
      packCenterLine28(centerLayers).byteLength +
      buildRowColorTable(centerProps).byteLength
  },
  ...(hasBand
    ? {
        'pack-band': () => {
          sink += packBandInstances(bandLayers).byteLength
        },
        'pack-band36': () => {
          sink += packBand36(bandLayers).byteLength
        },
      }
    : {}),
  'paint-step-bicolor': () => {
    for (const l of paintLayers) {
      drawLine({ ...rowArgs(ctx, l), rgb: POS, negRgb: NEG })
    }
  },
  'paint-step-mono': () => {
    for (const l of paintLayers) {
      drawLine({ ...rowArgs(ctx, l), rgb: POS, negRgb: POS })
    }
  },
  'paint-center-bicolor': () => {
    for (const l of paintCenterLayers) {
      drawLineCenter({ ...rowArgs(ctx, l), rgb: POS, negRgb: NEG })
    }
  },
  'paint-center-mono': () => {
    for (const l of paintCenterLayers) {
      drawLineCenter({ ...rowArgs(ctx, l), rgb: POS, negRgb: POS })
    }
  },
  'walk-step-bicolor': () => {
    for (const l of paintLayers) {
      drawLine({ ...rowArgs(noopCtx, l), rgb: POS, negRgb: NEG })
    }
  },
  'walk-step-mono': () => {
    for (const l of paintLayers) {
      drawLine({ ...rowArgs(noopCtx, l), rgb: POS, negRgb: POS })
    }
  },
}

// A fresh random order each round, and a full GC ahead of every arm outside
// its window: the packers allocate up to hundreds of MB of backing store, and
// without both an arm's time depended on which arm's garbage it followed
// (a byte-identical worker control read 0.60x before this).
const gc = (globalThis as { gc?: () => void }).gc
if (!gc) {
  throw new Error('run under node --expose-gc')
}
const names = Object.keys(arms)
const best = new Map<string, number>()
for (let round = 0; round < rounds; round++) {
  const order = [...names]
  for (let k = order.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1))
    ;[order[k], order[j]] = [order[j]!, order[k]!]
  }
  for (const name of order) {
    gc()
    const t0 = performance.now()
    arms[name]!()
    const ms = performance.now() - t0
    best.set(name, Math.min(best.get(name) ?? Infinity, ms))
  }
}
const timings = Object.fromEntries(
  names.map(n => [n, +best.get(n)!.toFixed(2)]),
)

const header = {
  files: files.map(f => f.split('/').pop()),
  refName: first.refName,
  start,
  viewBp,
  bpPerPx,
  screenPx,
  tier: first.tier,
  firstTier: first.firstTier,
  sources: numSources,
  sign,
  rounds,
  paintSources,
}
if (asJson) {
  console.log(JSON.stringify({ header, memory, timings }))
} else {
  console.log(header)
  console.log(memory)
  for (const n of names) {
    console.log(`  ${n.padEnd(26)} ${timings[n]!.toFixed(2).padStart(9)} ms`)
  }
}
void sink
void normalizedRgbToABGR
