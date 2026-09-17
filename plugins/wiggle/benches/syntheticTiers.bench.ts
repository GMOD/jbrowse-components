import { resolve } from 'node:path'
// What a synthetic tier costs and saves in the worker, per source, against the
// raw section the same zoom read before: one screen of one BigWig at one zoom.
//
//   node --experimental-transform-types --expose-gc \
//     plugins/wiggle/benches/syntheticTiers.bench.ts \
//     --file=/path/a.bw --refName=chr2 --start=130000000 --bpPerPx=319
//
// Flags: --file, --refName, --start, --bpPerPx, --screenPx (1500), --rounds
// (15), --json.
//
// Arms, interleaved in a fresh random order each round with a GC ahead of
// each, MIN across rounds (agent-docs/reference/BENCHMARKING.md), one literal
// each on purpose:
//
//   read-raw        bbi's raw section over the region, then
//                   processFeaturesFromArrays: the executor's work before
//   read-raw-ctl    the same, declared a second time
//   read-tier       the adapter's getFeatureArraysMulti at the zoom, then
//                   processFeaturesFromArrays: the executor's work now
//   bin             binRawRegion alone over the bin-aligned raw read
//   process-raw     processFeaturesFromArrays alone over the raw rows
//   process-tier    processFeaturesFromArrays alone over the tier's rows
//
// The bbi block cache is warm after the first round, so a read is a refetch
// over held blocks. Identity: the tier's rows must be binRawRegion over the
// bin-aligned raw read.
import { performance } from 'node:perf_hooks'

import { BigWig } from '@gmod/bbi'

import BigWigAdapter from '../src/BigWigAdapter/BigWigAdapter.ts'
import configSchema from '../src/BigWigAdapter/configSchema.ts'
import {
  binAlignedExtent,
  binRawRegion,
  sampleMeanRecordSpan,
  syntheticBinBp,
  syntheticReductionLevels,
} from '../src/BigWigAdapter/syntheticTiers.ts'
import { processFeaturesFromArrays } from '../src/util.ts'

import type { RawFeatureArrays } from '../src/util.ts'

const flag = (name: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1]
const num = (name: string, fallback: number) => Number(flag(name) ?? fallback)

const file = resolve(flag('file') ?? 'test_data/volvox/volvox_microarray.bw')
const start = num('start', 0)
const bpPerPx = num('bpPerPx', 1000)
const screenPx = num('screenPx', 1500)
const rounds = num('rounds', 15)
const asJson = process.argv.includes('--json')

const bigwig = new BigWig({ path: file })
const header = await bigwig.getHeader()
const refName = flag('refName') ?? Object.keys(header.refsByName)[0]!
const refLength = header.refsByNumber[header.refsByName[refName]!]!.length
const end = Math.min(refLength, Math.round(start + bpPerPx * screenPx))
const region = { refName, start, end, assemblyName: 'bench' }
const fileLevels = header.zoomLevels.map(z => z.reductionLevel)
const firstLevel = Math.min(...fileLevels)
const rawSpan = firstLevel / 4

const adapter = new BigWigAdapter(
  configSchema.create({
    bigWigLocation: { localPath: file, locationType: 'LocalPathLocation' },
  }),
)
const meanRecordSpan = await sampleMeanRecordSpan(await adapter.setup())
const { minBpPerPx: lo, maxBpPerPx: hi } = await adapter.getZoomRange({
  bpPerPx,
})
const binBp = syntheticBinBp(lo, firstLevel)

async function readRaw() {
  const res = await bigwig.getFeaturesAsArraysMulti([region], {
    basesPerSpan: rawSpan,
  })
  return {
    starts: res.starts,
    ends: res.ends,
    scores: res.scores,
    minScores: undefined,
    maxScores: undefined,
    count: res.starts.length,
  }
}
const raw = await readRaw()
const extent =
  binBp === undefined ? region : binAlignedExtent(start, end, binBp)
const aligned = await bigwig.getFeaturesAsArraysMulti(
  [{ refName, ...extent }],
  { basesPerSpan: rawSpan },
)
const [tier] = await adapter.getFeatureArraysMulti([region], { bpPerPx })

function sameRows(a: RawFeatureArrays, b: RawFeatureArrays, what: string) {
  if (a.count !== b.count) {
    throw new Error(`${what}: ${a.count} rows vs ${b.count}`)
  }
  for (let i = 0; i < a.count; i++) {
    for (const key of [
      'starts',
      'ends',
      'scores',
      'minScores',
      'maxScores',
    ] as const) {
      if (!Object.is(a[key]?.[i], b[key]?.[i])) {
        throw new Error(
          `${what}: row ${i} ${key} ${a[key]?.[i]} vs ${b[key]?.[i]}`,
        )
      }
    }
  }
}

function binAligned() {
  return binRawRegion(
    aligned.starts,
    aligned.ends,
    aligned.scores,
    0,
    aligned.starts.length,
    start,
    end,
    binBp!,
  )
}
if (binBp !== undefined) {
  sameRows(tier!, binAligned(), 'tier vs binRawRegion')
} else {
  sameRows(
    tier!,
    await adapter.getFeatureArraysMulti([region], { bpPerPx }).then(r => r[0]!),
    'file tier',
  )
}

let sink = 0
const arms: Record<string, () => Promise<void>> = {
  'read-raw': async () => {
    const r = await bigwig.getFeaturesAsArraysMulti([region], {
      basesPerSpan: rawSpan,
    })
    sink += processFeaturesFromArrays(
      {
        starts: r.starts,
        ends: r.ends,
        scores: r.scores,
        minScores: undefined,
        maxScores: undefined,
        count: r.starts.length,
      },
      0,
    ).numFeatures
  },
  'read-raw-ctl': async () => {
    const r = await bigwig.getFeaturesAsArraysMulti([region], {
      basesPerSpan: rawSpan,
    })
    sink += processFeaturesFromArrays(
      {
        starts: r.starts,
        ends: r.ends,
        scores: r.scores,
        minScores: undefined,
        maxScores: undefined,
        count: r.starts.length,
      },
      0,
    ).numFeatures
  },
  'read-tier': async () => {
    const [r] = await adapter.getFeatureArraysMulti([region], { bpPerPx })
    sink += processFeaturesFromArrays(r!, 0).numFeatures
  },
  bin: async () => {
    sink += binBp === undefined ? 0 : binAligned().count
  },
  'process-raw': async () => {
    sink += processFeaturesFromArrays(raw, 0).numFeatures
  },
  'process-tier': async () => {
    sink += processFeaturesFromArrays(tier!, 0).numFeatures
  },
}

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
    await arms[name]!()
    const ms = performance.now() - t0
    best.set(name, Math.min(best.get(name) ?? Infinity, ms))
  }
}

const MiB = 1024 * 1024
const px = (end - start) / bpPerPx
function rows(r: RawFeatureArrays) {
  const out = processFeaturesFromArrays(r, 0)
  const buffers = new Set(
    [
      out.featurePositions,
      out.featureScores,
      out.featureMinScores,
      out.featureMaxScores,
      out.posFeaturePositions,
      out.posFeatureScores,
      out.negFeaturePositions,
      out.negFeatureScores,
    ].map(a => a.buffer),
  )
  let wire = 0
  for (const b of buffers) {
    wire += b.byteLength
  }
  return {
    featuresPerSource: r.count,
    featuresPerPx: +(r.count / px).toFixed(2),
    wireMiBAt1000: +((wire * 1000) / MiB).toFixed(1),
    fillMiBAt1000: +((r.count * 20 * 1000) / MiB).toFixed(1),
    lineMiBAt1000: +((r.count * 44 * 1000) / MiB).toFixed(1),
  }
}
const result = {
  header: {
    file: file.split('/').pop(),
    refName,
    start,
    end,
    bpPerPx,
    fileLevels: fileLevels.slice(0, 3),
    meanRecordSpan: +meanRecordSpan.toFixed(2),
    syntheticLevels: syntheticReductionLevels(fileLevels, meanRecordSpan),
    tier:
      binBp === undefined
        ? lo === 0
          ? 'raw'
          : `file ${lo * 2}`
        : `synthetic ${binBp}`,
    zoomRange: [lo, hi],
    rounds,
  },
  raw: rows(raw),
  tier: rows(tier!),
  timings: Object.fromEntries(names.map(n => [n, +best.get(n)!.toFixed(2)])),
}
if (asJson) {
  console.log(JSON.stringify(result))
} else {
  console.log(result.header)
  console.log({ raw: result.raw, tier: result.tier })
  for (const n of names) {
    console.log(
      `  ${n.padEnd(14)} ${result.timings[n]!.toFixed(2).padStart(9)} ms`,
    )
  }
}
void sink
