import { resolve } from 'node:path'
// The mark display beside the wiggle display over one BigWig: the worker work
// each path does for one region at one zoom, over the same tier bbi picks for
// both (ADR-125), and how far a binned `mean` over a summary tier sits from
// the raw section it summarises.
//
//   node plugins/marks/benches/bigwigPaths.bench.ts
//   node plugins/marks/benches/bigwigPaths.bench.ts --file=/path/to/big.bw --refName=chr2 --rounds=9
//
// Flags: --file (default test_data/volvox/volvox_microarray.bw), --refName
// (default the header's first), --start (default 0), --screenPx (default
// 1500: each zoom fetches one screen of that width from --start, clamped to
// the contig, which is what a display's region fetch is), --zooms=<bp/px,...>
// (default one zoom inside each tier of the file, the raw section included),
// --rounds (default 7), --json.
//
// Four arms per zoom, interleaved round-robin, MIN across rounds
// (agent-docs/reference/BENCHMARKING.md), each a fetch plus what the RPC
// executor does with it:
//
//   wiggle      getFeatureArraysMulti, then processFeaturesFromArrays — the
//               RenderWiggleData executor's work for one region
//   control     the same, declared a second time
//   marks       getFeaturesArray, then encodeFeatures over the bar shape's
//               lanes — the CoreEncodeFeatures executor's work for
//               `{ shape: 'bar', encoding: { y: 'score' } }`
//   marks-mean  the same fetch through `bin: auto` and `aggregate: mean` first,
//               which is what a density-style declaration costs on top
//
// The bbi block cache is warm after the first round, so the MIN is a refetch
// over held blocks: the zoom-across-a-tier case, not a cold open.
//
// Identity: the wiggle arm's positions and scores are compared against the
// marks arm's x/x2/y before any time is believed, since both are supposed to
// be the same tier rows.
//
// The error rows: for a summary tier, `aggregate: mean` over `bin: auto` is
// a mean of tier means, unweighted, since bbi exports no validCnt. Against
// the raw section's coverage-weighted mean over the same bins, the bench
// reports the unweighted error and the error a span-weighted mean would have
// had, as a percentage of the raw score range. The gap between those two is
// the most a validCnt could buy.
import { performance } from 'node:perf_hooks'

import {
  aggregateFieldName,
  runTransforms,
} from '@jbrowse/core/util/featureTransforms'
import createJexlInstance from '@jbrowse/core/util/jexl'
import { encodeFeatures } from '@jbrowse/core/util/markEncoding'

import BigWigAdapter from '../../wiggle/src/BigWigAdapter/BigWigAdapter.ts'
import configSchema from '../../wiggle/src/BigWigAdapter/configSchema.ts'
import { tierSpanRange } from '../../wiggle/src/BigWigAdapter/tierSpanRange.ts'
import { processFeaturesFromArrays } from '../../wiggle/src/util.ts'
import { autoBinStep } from '../src/LinearMarkDisplay/autoBin.ts'

import type { Feature } from '@jbrowse/core/util'
import type { LaneName, TransformStep } from '@jbrowse/core/util/markEncoding'
import type { AugmentedRegion as Region } from '@jbrowse/core/util/types'

const flag = (name: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1]
const num = (name: string, fallback: number) => Number(flag(name) ?? fallback)

const file = resolve(flag('file') ?? 'test_data/volvox/volvox_microarray.bw')
const rounds = num('rounds', 7)
const asJson = process.argv.includes('--json')

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
const BAR_LANES: LaneName[] = ['y', 'color', 'colorValue', 'index']

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

// `aggregate: mean` over `bin: auto` against the raw section, per bin
function meanOfMeansError(
  tier: readonly Feature[],
  raw: RawRows,
  binBp: number,
) {
  const unweighted = new Map<number, { sum: number; n: number }>()
  const weighted = new Map<number, { sum: number; w: number }>()
  for (const f of tier) {
    const start = f.get('start')
    const end = f.get('end')
    const score = f.get('score')!
    const b = Math.floor(start / binBp)
    const u = unweighted.get(b) ?? { sum: 0, n: 0 }
    u.sum += score
    u.n += 1
    unweighted.set(b, u)
    const w = weighted.get(b) ?? { sum: 0, w: 0 }
    w.sum += score * (end - start)
    w.w += end - start
    weighted.set(b, w)
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
    const w = weighted.get(b)
    if (!u || !w) {
      continue
    }
    bins++
    const target = t.sum / t.w
    const errU = Math.abs(u.sum / u.n - target)
    const errW = Math.abs(w.sum / w.w - target)
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

const results = []
for (const bpPerPx of zooms) {
  const region = screenAt(bpPerPx)
  const arms = [
    ['wiggle', armWiggle(region, bpPerPx)],
    ['control', armControl(region, bpPerPx)],
    ['marks', armMarks(region, bpPerPx)],
    ['marks-mean', armMarksMean(region, bpPerPx)],
  ] as const

  const wiggle = await arms[0][1]()
  const marks = await arms[2][1]()
  if (wiggle.numFeatures !== marks.count) {
    throw new Error(
      `${bpPerPx} bp/px: wiggle holds ${wiggle.numFeatures} rows, marks ${marks.count}`,
    )
  }
  for (let i = 0; i < marks.count; i++) {
    if (
      wiggle.featurePositions[i * 2] !== marks.x[i] ||
      wiggle.featurePositions[i * 2 + 1] !== marks.x2[i] ||
      wiggle.featureScores[i] !== marks.y[i]
    ) {
      throw new Error(`${bpPerPx} bp/px: row ${i} differs between the paths`)
    }
  }

  const best = arms.map(() => Infinity)
  for (let r = 0; r < rounds; r++) {
    for (const [i, [, run]] of arms.entries()) {
      const t0 = performance.now()
      await run()
      best[i] = Math.min(best[i]!, performance.now() - t0)
    }
  }

  const tier = tierLabel(bpPerPx)
  const binBp = autoBinStep(bpPerPx)
  const error =
    tier === 'raw'
      ? undefined
      : meanOfMeansError(
          await adapter.getFeaturesArray(region, { bpPerPx }),
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
    binBp,
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
        : `  bin ${r.binBp}bp x${r.bins}: mean-of-means err ${r.meanErrPct}% mean, ${r.maxErrPct}% max; span-weighted ${r.weightedErrPct}%`
    console.log(
      `  ${String(r.bpPerPx).padStart(9)} bp/px  tier ${r.tier.padEnd(9)} ${String(r.regionBp).padStart(10)}bp rows ${String(r.rows).padStart(7)}  wiggle ${r.wiggleMs.toFixed(2).padStart(7)}ms  control ${r.controlMs.toFixed(2).padStart(7)}ms  marks ${r.marksMs.toFixed(2).padStart(7)}ms (${(r.marksMs / r.wiggleMs).toFixed(2)}x)  marks-mean ${r.marksMeanMs.toFixed(2).padStart(7)}ms${error}`,
    )
  }
}
