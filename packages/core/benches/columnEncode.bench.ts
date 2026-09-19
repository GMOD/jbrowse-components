// Would a column encoder — typed columns in, the same `EncodedChannels` out —
// dissolve the measured refusals to move a format-typed display onto the mark
// grammar?
//
//   node packages/core/benches/columnEncode.bench.ts --scenario=bigwig
//   node packages/core/benches/columnEncode.bench.ts --scenario=synthetic
//   node packages/core/benches/columnEncode.bench.ts --scenario=multi
//   node packages/core/benches/columnEncode.bench.ts --scenario=stack
//   node packages/core/benches/columnEncode.bench.ts --scenario=transforms
//
// Flags: --scenario, --rounds (11), --features (1000000, the synthetic table),
// --tiles (1000, copies of volvox's raw section), --sources (1000) and --rows
// (14000, the multi-wiggle shape), --reads (200000, the pileup), --allow-diff.
//
// THE QUESTION. ADR-114 refused canvas's packer at 3.11x, ADR-118 refused the
// pileup's layout at 4.23x and ADR-127 refused a `line` shape over 16 retained
// bytes a feature. All three attribute the cost to the `Feature[]` on one or
// both sides of the encoder, not to the grammar's rule. Wiggle's main path
// never builds a `Feature`: `RawFeatureArrays {starts, ends, scores}` goes
// straight into interleaved instance records, `EncodedChannels` is already a
// struct of arrays, and `bar`'s 20-byte instance record is wiggle's fill record
// word for word. So the substitution this prices is the encoder reading typed
// columns instead of features, with the transform steps as index-array kernels
// and one reusable row cursor standing in a `jexl:` channel's place.
//
// ARMS. Five scenarios, each its own process, because looping several fixtures
// through one set of arm objects contaminates every fixture after the first
// (agent-docs/reference/BENCHMARKING.md).
//
//   bigwig / synthetic / multi — the encode:
//     wiggle               processFeaturesFromArrays -> buildSourceRenderData
//                          -> packFillInstances, the shipping path
//     control              the same code through a second driver literal
//     features             a SimpleFeature per row -> encodeFeatures (bar
//                          lanes, no index) -> barMark.pass.pack. Not the
//                          shipping mark path: over a BigWig the display
//                          reads BigWigAdapter's two-field BigWigFeature
//                          cursor, which no arm here builds
//     columns              encodeColumns over the same columns -> the same pack
//     features-jexl        `features` with a jexl: colour
//     columns-cursor-jexl  `columns` with the same colour through one reused
//                          RowCursor
//   stack — 200,000 reads, ADR-118's fixture and its five arms rerun here
//     rather than quoted, plus:
//     stack-columns        argsort plus rowEnds over the typed positions
//     stack-columns-cmp    the same with the comparator argsort, so the sort
//                          and the placement are separable
//   transforms — 1,000,000 features, featureTransforms.bench.ts's fixture and
//     its `none`, `bin-count` and `coverage` arms rerun here, plus:
//     bin-count-columns, coverage-columns   the same steps as column kernels
//
// KILL CRITERIA, evaluated by agent-docs/ideas/column-encoder-verdict.md:
//   `columns` above 1.10x `wiggle` in time, or retaining more than wiggle's
//   12 bytes per feature plus 4; `stack-columns` above 1.5x `layout`;
//   `columns-cursor-jexl` above 1.2x `features-jexl`. A control row far from
//   1.00 means the run resolved nothing and the row is not reportable.
//
// The harness rules are BENCHMARKING.md's: arms interleaved and rotated in one
// process, MIN across rounds, a control that is the baseline's own code
// declared a second time, and every emitted field compared before any timing is
// believed — the run exits non-zero on a difference unless `--allow-diff` says
// it was deliberate. Recorded runs check AC power and print the load average.
//
// Two harness choices this bench had to make, both decided by what the control
// row did:
//
// A FRESH RANDOM ORDER each round, not `(k + round) % arms`. The rotation
// changes which arm leads but leaves every arm the same PREDECESSOR in every
// round, so `wiggle` ran after the heaviest arm every time and its control read
// 0.75-0.80x. Shuffling put the control back to 0.98-1.03x with nothing else
// changed. The seed is fixed so a re-run sees the same order.
//
// NO FORCED GC between arms. Calling `gc()` ahead of each timed arm — the
// mitigation `instanceBuffer.bench.ts` carries — put `layout` at 17.7ms here
// against `pileupLayoutVsStack.bench.ts`'s own 10.1ms in the same sitting: an
// arm allocating into a freshly swept heap pays for the pages, and that fixed
// tax compresses every ratio. Without it this harness reproduces both
// neighbouring benches' recorded rows.
//
// One fixture size resolves less well than the others, and is reported as such:
// at 1,000,000 rows in ONE source the control spreads 0.95-1.13x over six runs
// and `columns` 0.67-1.11x, which is the arms' own garbage deciding the row
// (BENCHMARKING.md, "a window LARGE enough"). At 500,000 the control holds
// 0.98-1.03x and `columns` repeats to within 0.16x; the multi-source scenario
// resolves at 14,000,000 rows because no single call allocates more than one
// source's worth. So the kill criteria are read on the 500,000-row rows.
import { readFileSync, readdirSync } from 'node:fs'
import { loadavg } from 'node:os'
import { resolve } from 'node:path'
import { performance } from 'node:perf_hooks'

import { computeLayout } from '../../../plugins/alignments/src/RenderAlignmentDataRPC/sortLayout.ts'
import BigWigAdapter from '../../../plugins/wiggle/src/BigWigAdapter/BigWigAdapter.ts'
import bigWigConfigSchema from '../../../plugins/wiggle/src/BigWigAdapter/configSchema.ts'
import { buildSourceRenderData } from '../../../plugins/wiggle/src/shared/buildSourceRenderData.ts'
import { packFillInstances } from '../../../plugins/wiggle/src/shared/wiggleInstanceBuffer.ts'
import {
  WIGGLE_NEG_COLOR_DEFAULT,
  WIGGLE_POS_COLOR_DEFAULT,
  processFeaturesFromArrays,
} from '../../../plugins/wiggle/src/util.ts'
import { barMark } from '../../render-core/src/marks/barMark.ts'
import { runTransforms } from '../src/util/featureTransforms.ts'
import createJexlInstance from '../src/util/jexl.ts'
import { DEFAULT_MARK_COLOR, encodeFeatures } from '../src/util/markEncoding.ts'
import SimpleFeature from '../src/util/simpleFeature.ts'
import {
  argsortByStart,
  argsortByStartComparator,
  binCountColumns,
  coverageColumns,
  encodeColumns,
  stackRows,
} from './columnTable.ts'

import type { WorkerPileupData } from '../../../plugins/alignments/src/RenderAlignmentDataRPC/types.ts'
import type { WiggleGpuProps } from '../../../plugins/wiggle/src/shared/buildSourceRenderData.ts'
import type { RawFeatureArrays } from '../../../plugins/wiggle/src/util.ts'
import type {
  EncodedChannels,
  LaneName,
  TransformStep,
} from '../src/util/markEncodingTypes.ts'
import type { Feature } from '../src/util/simpleFeature.ts'
import type { ColumnTable } from './columnTable.ts'

const flag = (name: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1]
const num = (name: string, fallback: number) => Number(flag(name) ?? fallback)

const scenario = flag('scenario') ?? 'synthetic'
const rounds = num('rounds', 11)
const allowDiff = process.argv.includes('--allow-diff')

const BAR_LANES: LaneName[] = ['y', 'color']
const JEXL_COLOR = 'jexl:feature.score > 5 ? "red" : "blue"'
const PIVOT = 0
const jexl = createJexlInstance()

function requireAcPower() {
  const dir = '/sys/class/power_supply'
  const online = readdirSync(dir)
    .filter(name => name.startsWith('AC'))
    .map(name => readFileSync(`${dir}/${name}/online`, 'utf8').trim())
  if (!online.includes('1')) {
    console.error(
      `not on AC power (${dir}/AC*/online read ${online.join(',')})`,
    )
    process.exit(1)
  }
  console.log(
    `AC power on, load average ${loadavg()
      .map(l => l.toFixed(2))
      .join(' ')}`,
  )
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

function encodedViews(channels: EncodedChannels[]) {
  return channels.flatMap(c => [
    c.x,
    c.x2,
    c.featureIndex,
    c.y,
    c.row,
    c.color,
    c.colorValue,
    c.glyph,
  ])
}

interface Driver {
  name: string
  run: () => unknown
}

let seed = 0x2f6e2b1
function nextRandom() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x80000000
}

function timeArms(drivers: Driver[]) {
  const best = drivers.map(() => Infinity)
  const order = drivers.map((_, i) => i)
  for (let r = 0; r < rounds; r++) {
    for (let k = order.length - 1; k > 0; k--) {
      const j = Math.floor(nextRandom() * (k + 1))
      ;[order[k], order[j]] = [order[j]!, order[k]!]
    }
    for (const i of order) {
      const t0 = performance.now()
      drivers[i]!.run()
      best[i] = Math.min(best[i]!, performance.now() - t0)
    }
  }
  return best
}

function reportArms(
  drivers: Driver[],
  best: number[],
  n: number,
  base: string,
) {
  const at = drivers.findIndex(d => d.name === base)
  console.log(`\nrounds=${rounds}, ${n.toLocaleString()} rows, min per arm`)
  for (const [i, { name }] of drivers.entries()) {
    const ms = best[i]!
    console.log(
      `  ${name.padEnd(20)} ${ms.toFixed(1).padStart(9)}ms  ` +
        `${((ms / n) * 1e6).toFixed(0).padStart(6)}ns/row  ` +
        `${(ms / best[at]!).toFixed(2)}x ${base}`,
    )
  }
}

const differences: string[] = []

function note(what: string) {
  differences.push(what)
  console.error(`DIFFERENCE: ${what}`)
}

function compareEncoded(a: EncodedChannels, b: EncodedChannels, what: string) {
  if (a.count !== b.count || a.skipped !== b.skipped) {
    note(
      `${what}: count ${a.count}/${b.count}, skipped ${a.skipped}/${b.skipped}`,
    )
    return
  }
  if (a.yMin !== b.yMin || a.yMax !== b.yMax) {
    note(`${what}: y extremes ${a.yMin},${a.yMax} against ${b.yMin},${b.yMax}`)
  }
  const lanes: [
    string,
    ArrayLike<number> | undefined,
    ArrayLike<number> | undefined,
  ][] = [
    ['x', a.x, b.x],
    ['x2', a.x2, b.x2],
    ['featureIndex', a.featureIndex, b.featureIndex],
    ['y', a.y, b.y],
    ['row', a.row, b.row],
    ['color', a.color, b.color],
  ]
  for (const [lane, left, right] of lanes) {
    if ((left === undefined) !== (right === undefined)) {
      note(`${what}: lane ${lane} present on one side only`)
      continue
    }
    if (!left || !right) {
      continue
    }
    for (let i = 0; i < a.count; i++) {
      if (!Object.is(left[i], right[i])) {
        note(
          `${what}: lane ${lane} differs at ${i} (${left[i]} against ${right[i]})`,
        )
        break
      }
    }
  }
}

function compareBuffers(
  a: ArrayBuffer,
  b: ArrayBuffer,
  words: number,
  what: string,
) {
  const au = new Uint32Array(a)
  const bu = new Uint32Array(b)
  for (let i = 0; i < words; i++) {
    if (au[i] !== bu[i]) {
      note(`${what}: instance word ${i} differs (${au[i]} against ${bu[i]})`)
      return
    }
  }
}

function finish() {
  if (differences.length > 0 && !allowDiff) {
    console.error(
      `\n${differences.length} difference(s); pass --allow-diff if deliberate`,
    )
    process.exit(1)
  }
}

interface SourceColumns {
  name: string
  raw: RawFeatureArrays
  table: ColumnTable
}

interface EncodeOutput {
  encoded: EncodedChannels[]
  wiggle: ReturnType<typeof processFeaturesFromArrays>[]
  buffers: ArrayBuffer[]
}

function asBuffer(packed: ArrayBuffer | ArrayBufferView) {
  return ArrayBuffer.isView(packed) ? (packed.buffer as ArrayBuffer) : packed
}

function makeTable(raw: RawFeatureArrays): ColumnTable {
  return {
    length: raw.count,
    columns: { start: raw.starts, end: raw.ends, score: raw.scores },
  }
}

async function bigwigFixture(): Promise<SourceColumns[]> {
  const tiles = num('tiles', 1000)
  const adapter = new BigWigAdapter(
    bigWigConfigSchema.create({
      bigWigLocation: {
        localPath: resolve('test_data/volvox/volvox_microarray.bw'),
        locationType: 'LocalPathLocation',
      },
    }),
  )
  const { header } = await adapter.setup()
  const refName = Object.keys(header.refsByName)[0]!
  const length = header.refsByNumber[header.refsByName[refName]!]!.length
  const [section] = await adapter.getFeatureArraysMulti(
    [{ refName, start: 0, end: length, assemblyName: 'bench' }],
    { bpPerPx: 1 },
  )
  const one = section!
  const count = one.count * tiles
  const starts = new Int32Array(count)
  const ends = new Int32Array(count)
  const scores = new Float32Array(count)
  for (let t = 0; t < tiles; t++) {
    const shift = t * length
    for (let i = 0; i < one.count; i++) {
      const at = t * one.count + i
      starts[at] = one.starts[i]! + shift
      ends[at] = one.ends[i]! + shift
      scores[at] = one.scores[i]!
    }
  }
  console.log(
    `volvox_microarray.bw ${refName} raw section: ${one.count} rows, tiled ${tiles}x`,
  )
  const raw: RawFeatureArrays = {
    starts,
    ends,
    scores,
    minScores: undefined,
    maxScores: undefined,
    count,
  }
  return [{ name: 's0', raw, table: makeTable(raw) }]
}

function syntheticSource(name: string, n: number, phase: number) {
  const starts = new Int32Array(n)
  const ends = new Int32Array(n)
  const scores = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    starts[i] = i * 3
    ends[i] = i * 3 + 2
    scores[i] = ((i + phase) * 7919) % 1000
  }
  const raw: RawFeatureArrays = {
    starts,
    ends,
    scores,
    minScores: undefined,
    maxScores: undefined,
    count: n,
  }
  return { name, raw, table: makeTable(raw) }
}

function syntheticFixture(): SourceColumns[] {
  const n = num('features', 1_000_000)
  console.log(`one synthetic source of ${n.toLocaleString()} rows`)
  return [syntheticSource('s0', n, 0)]
}

function multiFixture(): SourceColumns[] {
  const sources = num('sources', 1000)
  const rows = num('rows', 14_000)
  console.log(
    `${sources} sources of ${rows.toLocaleString()} rows, the multi-wiggle shape`,
  )
  const out: SourceColumns[] = []
  for (let s = 0; s < sources; s++) {
    const starts = new Int32Array(rows)
    const ends = new Int32Array(rows)
    const scores = new Float32Array(rows)
    for (let i = 0; i < rows; i++) {
      starts[i] = i * 34
      ends[i] = i * 34 + 34
      scores[i] = ((i + s) * 7919) % 1000
    }
    const raw: RawFeatureArrays = {
      starts,
      ends,
      scores,
      minScores: undefined,
      maxScores: undefined,
      count: rows,
    }
    out.push({ name: `s${s}`, raw, table: makeTable(raw) })
  }
  return out
}

function runEncodeScenario(fixture: SourceColumns[]) {
  const total = fixture.reduce((sum, s) => sum + s.table.length, 0)
  const gpuProps: WiggleGpuProps = {
    sources: fixture.map(s => ({ name: s.name })),
    faceted: true,
    wiggleColor: {
      posColor: WIGGLE_POS_COLOR_DEFAULT,
      negColor: WIGGLE_NEG_COLOR_DEFAULT,
      pivot: PIVOT,
      rampLut: null,
      perSource: false,
    },
    effectiveSummaryScoreMode: 'avg',
    renderingType: 'xyplot',
    maxGapMultiple: 0,
  }

  // Six driver literals, written out rather than shared or generated: a driver
  // reused across arms takes its call sites polymorphic and prices the harness
  // instead of the code. The duplication is deliberate.
  const drivers: { name: string; run: () => EncodeOutput }[] = [
    {
      name: 'wiggle',
      run: () => {
        const wiggle = fixture.map(s => processFeaturesFromArrays(s.raw))
        const layers = buildSourceRenderData(
          { sources: wiggle.map((w, i) => ({ name: fixture[i]!.name, ...w })) },
          gpuProps,
        )
        return { encoded: [], wiggle, buffers: [packFillInstances(layers)] }
      },
    },
    {
      name: 'control',
      run: () => {
        const wiggle = fixture.map(s => processFeaturesFromArrays(s.raw))
        const layers = buildSourceRenderData(
          { sources: wiggle.map((w, i) => ({ name: fixture[i]!.name, ...w })) },
          gpuProps,
        )
        return { encoded: [], wiggle, buffers: [packFillInstances(layers)] }
      },
    },
    {
      name: 'features',
      run: () => {
        const encoded: EncodedChannels[] = []
        const buffers: ArrayBuffer[] = []
        for (const source of fixture) {
          const { starts, ends, scores, count } = source.raw
          const features: Feature[] = []
          for (let i = 0; i < count; i++) {
            features.push(
              new SimpleFeature({
                uniqueId: `f${i}`,
                refName: 'chr1',
                start: starts[i]!,
                end: ends[i]!,
                score: scores[i]!,
              }),
            )
          }
          const c = encodeFeatures(
            features,
            { y: 'score', color: DEFAULT_MARK_COLOR },
            BAR_LANES,
          )
          encoded.push(c)
          buffers.push(
            asBuffer(
              barMark.pass.pack({
                x: c.x,
                x2: c.x2,
                y: c.y,
                color: c.color,
                count: c.count,
              }),
            ),
          )
        }
        return { encoded, wiggle: [], buffers }
      },
    },
    {
      name: 'columns',
      run: () => {
        const encoded: EncodedChannels[] = []
        const buffers: ArrayBuffer[] = []
        for (const source of fixture) {
          const c = encodeColumns(
            source.table,
            { y: 'score', color: DEFAULT_MARK_COLOR },
            BAR_LANES,
          )
          encoded.push(c)
          buffers.push(
            asBuffer(
              barMark.pass.pack({
                x: c.x,
                x2: c.x2,
                y: c.y!,
                color: c.color,
                count: c.count,
              }),
            ),
          )
        }
        return { encoded, wiggle: [], buffers }
      },
    },
    {
      name: 'features-jexl',
      run: () => {
        const encoded: EncodedChannels[] = []
        const buffers: ArrayBuffer[] = []
        for (const source of fixture) {
          const { starts, ends, scores, count } = source.raw
          const features: Feature[] = []
          for (let i = 0; i < count; i++) {
            features.push(
              new SimpleFeature({
                uniqueId: `f${i}`,
                refName: 'chr1',
                start: starts[i]!,
                end: ends[i]!,
                score: scores[i]!,
              }),
            )
          }
          const c = encodeFeatures(
            features,
            { y: 'score', color: JEXL_COLOR },
            BAR_LANES,
            { jexl },
          )
          encoded.push(c)
          buffers.push(
            asBuffer(
              barMark.pass.pack({
                x: c.x,
                x2: c.x2,
                y: c.y,
                color: c.color,
                count: c.count,
              }),
            ),
          )
        }
        return { encoded, wiggle: [], buffers }
      },
    },
    {
      name: 'columns-cursor-jexl',
      run: () => {
        const encoded: EncodedChannels[] = []
        const buffers: ArrayBuffer[] = []
        for (const source of fixture) {
          const c = encodeColumns(
            source.table,
            { y: 'score', color: JEXL_COLOR },
            BAR_LANES,
            { jexl },
          )
          encoded.push(c)
          buffers.push(
            asBuffer(
              barMark.pass.pack({
                x: c.x,
                x2: c.x2,
                y: c.y!,
                color: c.color,
                count: c.count,
              }),
            ),
          )
        }
        return { encoded, wiggle: [], buffers }
      },
    },
  ]

  const warm = drivers.map(d => d.run())
  const byName = new Map(drivers.map((d, i) => [d.name, warm[i]!]))
  const wiggleOut = byName.get('wiggle')!
  const featuresOut = byName.get('features')!
  const columnsOut = byName.get('columns')!
  const featuresJexlOut = byName.get('features-jexl')!
  const columnsJexlOut = byName.get('columns-cursor-jexl')!

  for (const [i, source] of fixture.entries()) {
    compareEncoded(
      featuresOut.encoded[i]!,
      columnsOut.encoded[i]!,
      `${source.name} features against columns`,
    )
    compareEncoded(
      featuresJexlOut.encoded[i]!,
      columnsJexlOut.encoded[i]!,
      `${source.name} features-jexl against columns-cursor-jexl`,
    )
    const w = wiggleOut.wiggle[i]!
    const c = columnsOut.encoded[i]!
    if (w.numFeatures !== c.count) {
      note(
        `${source.name}: wiggle ${w.numFeatures} rows against columns ${c.count}`,
      )
      continue
    }
    for (let k = 0; k < c.count; k++) {
      if (
        w.featurePositions[k * 2] !== c.x[k] ||
        w.featurePositions[k * 2 + 1] !== c.x2[k] ||
        w.featureScores[k] !== c.y![k]
      ) {
        note(`${source.name}: wiggle and columns disagree at row ${k}`)
        break
      }
    }
  }
  compareBuffers(
    wiggleOut.buffers[0]!,
    columnsOut.buffers[0]!,
    fixture[0]!.table.length * 5,
    'wiggle fill record against bar instance record',
  )

  const distinct = new Set(columnsJexlOut.encoded[0]!.color!.slice(0, 1000))
  console.log(
    `identity: ${differences.length} difference(s); the jexl colour answered ` +
      `${distinct.size} distinct value(s) over the first 1,000 rows`,
  )

  const wiggleBytes = uniqueBytes(
    wiggleOut.wiggle.flatMap(w => [
      w.featurePositions,
      w.featureScores,
      w.featureMinScores,
      w.featureMaxScores,
    ]),
  )
  const encodedBytes = uniqueBytes(encodedViews(columnsOut.encoded))
  const featureBytes = uniqueBytes(encodedViews(featuresOut.encoded))
  const instanceBytes = columnsOut.buffers.reduce((n, b) => n + b.byteLength, 0)
  console.log(
    `\nretained payload per feature: wiggle ${(wiggleBytes / total).toFixed(1)}B, ` +
      `features ${(featureBytes / total).toFixed(1)}B, ` +
      `columns ${(encodedBytes / total).toFixed(1)}B; ` +
      `instance record ${(instanceBytes / total).toFixed(1)}B on every arm`,
  )

  reportArms(drivers, timeArms(drivers), total, 'wiggle')
  finish()
}

function runStackScenario() {
  const reads = num('reads', 200_000)
  const span = num('span', 600_000)
  const readLen = num('readlen', 150)
  const readPositions = new Uint32Array(reads * 2)
  for (let i = 0; i < reads; i++) {
    const start = Math.floor((i / reads) * span)
    readPositions[i * 2] = start
    readPositions[i * 2 + 1] = start + readLen
  }
  const data = {
    readKeys: Array.from({ length: reads }, (_, i) => `id${i}`),
    readPositions,
  } as unknown as WorkerPileupData
  const starts = new Uint32Array(reads)
  const ends = new Uint32Array(reads)
  for (let i = 0; i < reads; i++) {
    starts[i] = readPositions[i * 2]!
    ends[i] = readPositions[i * 2 + 1]!
  }
  const STEPS: TransformStep[] = [{ type: 'stack', padding: 2 }]
  const makeFeatures = () => {
    const out: Feature[] = []
    for (let i = 0; i < reads; i++) {
      out.push(
        new SimpleFeature({
          uniqueId: `id${i}`,
          refName: 'chr1',
          start: starts[i]!,
          end: ends[i]!,
        }),
      )
    }
    return out
  }
  const prebuilt = makeFeatures()
  const stackToRows = (features: readonly Feature[]) => {
    const out = runTransforms(features, STEPS)
    const rows = new Uint16Array(out.length)
    for (let i = 0; i < out.length; i++) {
      rows[i] = out[i]!.get('row') as number
    }
    return rows
  }
  console.log(
    `${reads.toLocaleString()} reads of ${readLen}bp over ${span.toLocaleString()}bp`,
  )

  // One literal per arm; the duplication between `layout` and `control` is
  // deliberate and is what makes their ratio the harness's own resolution.
  const drivers: { name: string; run: () => number }[] = [
    { name: 'layout', run: () => computeLayout(data).readYs.length },
    { name: 'control', run: () => computeLayout(data).readYs.length },
    { name: 'stack', run: () => stackToRows(makeFeatures()).length },
    { name: 'step', run: () => stackToRows(prebuilt).length },
    { name: 'features', run: () => makeFeatures().length },
    {
      name: 'stack-columns',
      run: () =>
        stackRows(argsortByStart(starts, reads), starts, ends, 2).length,
    },
    {
      name: 'stack-columns-cmp',
      run: () =>
        stackRows(argsortByStartComparator(starts, reads), starts, ends, 2)
          .length,
    },
  ]

  for (const driver of drivers) {
    driver.run()
  }
  const layoutRows = computeLayout(data).readYs
  const stepRows = stackToRows(prebuilt)
  const order = argsortByStart(starts, reads)
  const columnRows = stackRows(order, starts, ends, 2)
  for (let k = 0; k < reads; k++) {
    if (layoutRows[order[k]!] !== columnRows[k]) {
      note(
        `stack-columns row ${k} (read ${order[k]}) is ${columnRows[k]}, layout says ${layoutRows[order[k]!]}`,
      )
      break
    }
  }
  for (let i = 0; i < reads; i++) {
    if (layoutRows[i] !== stepRows[i]) {
      note(`stack row ${i} is ${stepRows[i]}, layout says ${layoutRows[i]}`)
      break
    }
  }
  let deepest = 0
  for (let i = 0; i < reads; i++) {
    deepest = Math.max(deepest, layoutRows[i]!)
  }
  console.log(
    `identity: ${differences.length} difference(s); the packing is ${deepest + 1} rows deep`,
  )

  reportArms(drivers, timeArms(drivers), reads, 'layout')
  finish()
}

function runTransformScenario() {
  const n = num('features', 1_000_000)
  const starts = new Uint32Array(n)
  const ends = new Uint32Array(n)
  const scores = new Float32Array(n)
  const features: Feature[] = []
  for (let i = 0; i < n; i++) {
    starts[i] = i * 3
    ends[i] = i * 3 + 2 + (i % 5)
    scores[i] = (i * 7919) % 1000
    features.push(
      new SimpleFeature({
        uniqueId: `f${i}`,
        refName: 'chr1',
        start: starts[i]!,
        end: ends[i]!,
        score: scores[i]!,
      }),
    )
  }
  const table: ColumnTable = {
    length: n,
    columns: { start: starts, end: ends, score: scores },
  }
  const BIN: TransformStep[] = [
    { type: 'bin', step: 10_000 },
    { type: 'aggregate', groupby: ['start', 'end'], ops: [{ op: 'count' }] },
  ]
  const COVERAGE: TransformStep[] = [{ type: 'coverage' }]
  console.log(`${n.toLocaleString()} features, the transform-step fixture`)

  // One literal per arm; `none` and `control` are the same code twice on
  // purpose.
  const drivers: { name: string; run: () => EncodedChannels }[] = [
    {
      name: 'none',
      run: () =>
        encodeFeatures(features, { y: 'score', color: 'red' }, BAR_LANES),
    },
    {
      name: 'control',
      run: () =>
        encodeFeatures(features, { y: 'score', color: 'red' }, BAR_LANES),
    },
    {
      name: 'bin-count',
      run: () =>
        encodeFeatures(
          runTransforms(features, BIN, jexl),
          { y: 'count', color: 'red' },
          BAR_LANES,
        ),
    },
    {
      name: 'bin-count-columns',
      run: () =>
        encodeColumns(
          binCountColumns(table, 10_000),
          { y: 'count', color: 'red' },
          BAR_LANES,
        ),
    },
    {
      name: 'coverage',
      run: () =>
        encodeFeatures(
          runTransforms(features, COVERAGE, jexl),
          { y: 'coverage', color: 'red' },
          BAR_LANES,
        ),
    },
    {
      name: 'coverage-columns',
      run: () =>
        encodeColumns(
          coverageColumns(table),
          { y: 'coverage', color: 'red' },
          BAR_LANES,
        ),
    },
  ]

  const warm = drivers.map(d => d.run())
  compareEncoded(warm[2]!, warm[3]!, 'bin-count against bin-count-columns')
  compareEncoded(warm[4]!, warm[5]!, 'coverage against coverage-columns')
  console.log(
    `identity: ${differences.length} difference(s); bin-count emits ` +
      `${warm[2]!.count} rows, coverage ${warm[4]!.count}`,
  )

  reportArms(drivers, timeArms(drivers), n, 'none')
  finish()
}

requireAcPower()
switch (scenario) {
  case 'bigwig': {
    runEncodeScenario(await bigwigFixture())
    break
  }
  case 'synthetic': {
    runEncodeScenario(syntheticFixture())
    break
  }
  case 'multi': {
    runEncodeScenario(multiFixture())
    break
  }
  case 'stack': {
    runStackScenario()
    break
  }
  case 'transforms': {
    runTransformScenario()
    break
  }
  default: {
    console.error(
      `--scenario=${scenario} is none of bigwig, synthetic, multi, stack, transforms`,
    )
    process.exit(1)
  }
}
